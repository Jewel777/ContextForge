from __future__ import annotations

import asyncio
import os
import re
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer, got {raw!r}") from exc
    if value < 1:
        raise RuntimeError(f"{name} must be >= 1")
    return value


def _normalize_origin(value: str) -> str:
    return value.strip().rstrip("/")


def _valid_origin(value: str) -> bool:
    parsed = urlparse(value)
    return (
        parsed.scheme in {"http", "https"}
        and bool(parsed.netloc)
        and not parsed.path.strip("/")
        and not parsed.query
        and not parsed.fragment
    )


@dataclass(frozen=True)
class SecuritySettings:
    environment: str
    allowed_origins: tuple[str, ...]
    max_request_bytes: int
    rate_limit_enabled: bool
    rate_limit_requests: int
    rate_limit_window_seconds: int

    @property
    def production(self) -> bool:
        return self.environment == "production"

    @classmethod
    def from_env(cls) -> "SecuritySettings":
        settings = cls(
            environment=os.getenv("CONTEXTFORGE_ENV", "development").strip().lower(),
            allowed_origins=tuple(
                _normalize_origin(item)
                for item in os.getenv("CONTEXTFORGE_ALLOWED_ORIGINS", "").split(",")
                if item.strip()
            ),
            max_request_bytes=_positive_int(
                "CONTEXTFORGE_MAX_REQUEST_BYTES", 20 * 1024 * 1024
            ),
            rate_limit_enabled=_bool_env("CONTEXTFORGE_RATE_LIMIT_ENABLED", False),
            rate_limit_requests=_positive_int(
                "CONTEXTFORGE_RATE_LIMIT_REQUESTS", 600
            ),
            rate_limit_window_seconds=_positive_int(
                "CONTEXTFORGE_RATE_LIMIT_WINDOW_SECONDS", 60
            ),
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        if self.production:
            if not self.allowed_origins:
                raise RuntimeError(
                    "CONTEXTFORGE_ALLOWED_ORIGINS is required in production."
                )
            if "*" in self.allowed_origins:
                raise RuntimeError(
                    "Wildcard origins are forbidden in production."
                )
            for origin in self.allowed_origins:
                if not _valid_origin(origin):
                    raise RuntimeError(
                        f"Invalid production origin: {origin!r}"
                    )

        if self.max_request_bytes < 1024:
            raise RuntimeError(
                "CONTEXTFORGE_MAX_REQUEST_BYTES must be at least 1024."
            )


class PayloadTooLarge(Exception):
    pass


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def allow(self, key: str) -> tuple[bool, int]:
        now = time.monotonic()
        cutoff = now - self.window_seconds

        async with self._lock:
            bucket = self._requests[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.max_requests:
                retry_after = max(
                    1, int(self.window_seconds - (now - bucket[0]))
                )
                return False, retry_after

            bucket.append(now)
            return True, 0


class ContextForgeSecurityMiddleware:
    def __init__(self, app: Any, settings: SecuritySettings) -> None:
        self.app = app
        self.settings = settings
        self.limiter = SlidingWindowLimiter(
            settings.rate_limit_requests,
            settings.rate_limit_window_seconds,
        )

    @staticmethod
    def _headers(scope: dict[str, Any]) -> dict[str, str]:
        return {
            key.decode("latin1").lower(): value.decode("latin1")
            for key, value in scope.get("headers", [])
        }

    @staticmethod
    async def _send_json(
        send: Any,
        status: int,
        payload: bytes,
        *,
        extra_headers: list[tuple[bytes, bytes]] | None = None,
    ) -> None:
        headers = [
            (b"content-type", b"application/json; charset=utf-8"),
            (b"content-length", str(len(payload)).encode("ascii")),
            (b"cache-control", b"no-store"),
            (b"x-content-type-options", b"nosniff"),
        ]
        if extra_headers:
            headers.extend(extra_headers)

        await send(
            {"type": "http.response.start", "status": status, "headers": headers}
        )
        await send({"type": "http.response.body", "body": payload})

    @staticmethod
    def _client_key(scope: dict[str, Any]) -> str:
        client = scope.get("client")
        if isinstance(client, (tuple, list)) and client:
            return str(client[0])
        return "unknown"

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        headers = self._headers(scope)
        method = str(scope.get("method", "GET")).upper()
        path = str(scope.get("path", ""))

        incoming_request_id = headers.get("x-request-id", "")
        request_id = (
            incoming_request_id
            if _REQUEST_ID_RE.fullmatch(incoming_request_id)
            else uuid.uuid4().hex
        )

        origin = _normalize_origin(headers.get("origin", ""))
        if (
            self.settings.production
            and origin
            and origin not in self.settings.allowed_origins
        ):
            await self._send_json(
                send,
                403,
                b'{"detail":"Origin not allowed"}',
                extra_headers=[
                    (b"x-request-id", request_id.encode("ascii"))
                ],
            )
            return

        content_length = headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > self.settings.max_request_bytes:
                    await self._send_json(
                        send,
                        413,
                        b'{"detail":"Request body too large"}',
                        extra_headers=[
                            (b"x-request-id", request_id.encode("ascii"))
                        ],
                    )
                    return
            except ValueError:
                await self._send_json(
                    send,
                    400,
                    b'{"detail":"Invalid Content-Length"}',
                    extra_headers=[
                        (b"x-request-id", request_id.encode("ascii"))
                    ],
                )
                return

        if (
            self.settings.rate_limit_enabled
            and method != "OPTIONS"
            and not (method == "GET" and path in {"/", "/health"})
        ):
            allowed, retry_after = await self.limiter.allow(
                self._client_key(scope)
            )
            if not allowed:
                await self._send_json(
                    send,
                    429,
                    b'{"detail":"Too many requests"}',
                    extra_headers=[
                        (b"retry-after", str(retry_after).encode("ascii")),
                        (b"x-request-id", request_id.encode("ascii")),
                    ],
                )
                return

        received = 0
        response_started = False

        async def limited_receive() -> dict[str, Any]:
            nonlocal received
            message = await receive()
            if message.get("type") == "http.request":
                received += len(message.get("body", b""))
                if received > self.settings.max_request_bytes:
                    raise PayloadTooLarge
            return message

        async def secure_send(message: dict[str, Any]) -> None:
            nonlocal response_started
            if message.get("type") == "http.response.start":
                response_started = True
                response_headers = list(message.get("headers", []))
                existing = {
                    key.lower() for key, _value in response_headers
                }
                desired = [
                    (b"x-request-id", request_id.encode("ascii")),
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                    (
                        b"permissions-policy",
                        b"camera=(), microphone=(), geolocation=()",
                    ),
                    (b"cache-control", b"no-store"),
                ]
                for key, value in desired:
                    if key not in existing:
                        response_headers.append((key, value))
                message["headers"] = response_headers

            await send(message)

        try:
            await self.app(scope, limited_receive, secure_send)
        except PayloadTooLarge:
            if not response_started:
                await self._send_json(
                    send,
                    413,
                    b'{"detail":"Request body too large"}',
                    extra_headers=[
                        (b"x-request-id", request_id.encode("ascii"))
                    ],
                )
                return
            raise


def install_security(app: Any) -> SecuritySettings:
    settings = SecuritySettings.from_env()
    app.add_middleware(
        ContextForgeSecurityMiddleware,
        settings=settings,
    )
    return settings
