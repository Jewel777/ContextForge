from __future__ import annotations

import os
import sys


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise SystemExit(f"{name} must be an integer, got {raw!r}") from exc
    if value < 1:
        raise SystemExit(f"{name} must be >= 1")
    return value


def main() -> None:
    env = os.getenv("CONTEXTFORGE_ENV", "production").strip().lower()
    host = os.getenv("CONTEXTFORGE_HOST", "0.0.0.0").strip()
    port = _positive_int("CONTEXTFORGE_PORT", 8001)
    workers = _positive_int("CONTEXTFORGE_WORKERS", 2)
    forwarded_allow_ips = os.getenv("CONTEXTFORGE_FORWARDED_ALLOW_IPS", "127.0.0.1,::1").strip()

    if env == "production" and host in {"127.0.0.1", "localhost"}:
        print(
            "WARNING: production engine is bound to loopback only; "
            "container/reverse-proxy deployments usually need 0.0.0.0.",
            file=sys.stderr,
        )

    import uvicorn

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        workers=workers,
        reload=False,
        proxy_headers=True,
        forwarded_allow_ips=forwarded_allow_ips,
        log_level="info",
    )


if __name__ == "__main__":
    main()
