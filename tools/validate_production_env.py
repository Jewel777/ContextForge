from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def is_http_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def main() -> int:
    env_path = ROOT / ".env.production"
    file_values = load_env_file(env_path)

    def get(name: str, default: str = "") -> str:
        return os.getenv(name, file_values.get(name, default)).strip()

    errors: list[str] = []
    warnings: list[str] = []

    if not env_path.exists():
        errors.append(
            f"Missing {env_path}. Copy .env.production.example to .env.production "
            "and replace example values."
        )

    public_url = get("NEXT_PUBLIC_CONTEXTFORGE_URL")
    api_url = get("CONTEXTFORGE_API_URL")
    origins = [
        item.strip()
        for item in get("CONTEXTFORGE_ALLOWED_ORIGINS").split(",")
        if item.strip()
    ]

    if public_url and not is_http_url(public_url):
        errors.append("NEXT_PUBLIC_CONTEXTFORGE_URL must be an absolute http(s) URL.")

    if api_url and not is_http_url(api_url):
        errors.append("CONTEXTFORGE_API_URL must be an absolute http(s) URL.")

    if not origins:
        errors.append("CONTEXTFORGE_ALLOWED_ORIGINS must contain at least one origin.")
    else:
        for origin in origins:
            if not is_http_url(origin):
                errors.append(
                    f"Invalid CONTEXTFORGE_ALLOWED_ORIGINS entry: {origin!r}"
                )

    if public_url.startswith("http://") and "localhost" not in public_url:
        warnings.append(
            "NEXT_PUBLIC_CONTEXTFORGE_URL uses HTTP. Public production deployments "
            "should normally use HTTPS."
        )

    if "*" in origins:
        errors.append(
            "Wildcard CORS origin '*' is not accepted for production validation."
        )

    workers_raw = get("CONTEXTFORGE_WORKERS", "2")
    try:
        workers = int(workers_raw)
        if workers < 1:
            raise ValueError
    except ValueError:
        errors.append("CONTEXTFORGE_WORKERS must be a positive integer.")

    if get("CONTEXTFORGE_ENV", "production").lower() != "production":
        warnings.append("CONTEXTFORGE_ENV is not set to 'production'.")

    print("=" * 72)
    print("ContextForge production environment validation")
    print("=" * 72)

    if warnings:
        print("\nWARNINGS")
        for item in warnings:
            print(f"  - {item}")

    if errors:
        print("\nERRORS")
        for item in errors:
            print(f"  - {item}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print(f"Public URL: {public_url or '(not set)'}")
    print(f"Engine URL: {api_url or '(not set)'}")
    print(f"Allowed origins: {', '.join(origins)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
