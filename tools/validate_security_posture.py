from __future__ import annotations

import os
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


def valid_origin(value: str) -> bool:
    parsed = urlparse(value)
    return (
        parsed.scheme in {"http", "https"}
        and bool(parsed.netloc)
        and not parsed.path.strip("/")
        and not parsed.query
        and not parsed.fragment
    )


def main() -> int:
    env = load_env_file(ROOT / ".env.production")

    def get(name: str, default: str = "") -> str:
        return os.getenv(name, env.get(name, default)).strip()

    errors: list[str] = []
    warnings: list[str] = []

    origins = [
        item.strip().rstrip("/")
        for item in get("CONTEXTFORGE_ALLOWED_ORIGINS").split(",")
        if item.strip()
    ]

    if not origins:
        errors.append("No production allowed origins configured.")
    elif "*" in origins:
        errors.append("Wildcard production origins are forbidden.")
    else:
        for origin in origins:
            if not valid_origin(origin):
                errors.append(f"Invalid exact origin: {origin!r}")

    max_bytes_raw = get(
        "CONTEXTFORGE_MAX_REQUEST_BYTES", str(20 * 1024 * 1024)
    )
    try:
        max_bytes = int(max_bytes_raw)
        if max_bytes < 1024:
            raise ValueError
    except ValueError:
        errors.append("CONTEXTFORGE_MAX_REQUEST_BYTES must be >= 1024.")
        max_bytes = 0

    rate_enabled = get(
        "CONTEXTFORGE_RATE_LIMIT_ENABLED", "false"
    ).lower() in {"1", "true", "yes", "on"}

    if not rate_enabled:
        warnings.append(
            "Engine rate limiting is disabled. This is acceptable when the "
            "public edge/load balancer provides rate limiting."
        )

    forwarded = get(
        "CONTEXTFORGE_FORWARDED_ALLOW_IPS", "127.0.0.1,::1"
    )
    if forwarded == "*":
        errors.append(
            "CONTEXTFORGE_FORWARDED_ALLOW_IPS='*' is forbidden in production."
        )

    required_files = [
        ROOT / "engine" / "security.py",
        ROOT / "web" / "proxy.ts",
    ]
    for path in required_files:
        if not path.exists():
            errors.append(f"Missing security file: {path}")

    proxy_path = ROOT / "web" / "proxy.ts"
    if proxy_path.exists():
        text = proxy_path.read_text(encoding="utf-8")
        for header in [
            "Content-Security-Policy",
            "Strict-Transport-Security",
            "X-Content-Type-Options",
            "X-Frame-Options",
            "Permissions-Policy",
        ]:
            if header not in text:
                errors.append(
                    f"web/proxy.ts is missing required header: {header}"
                )

        if '"script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'"' not in text:
            errors.append(
                "web/proxy.ts must scope unsafe-eval to the development CSP branch."
            )

        production_branch = '"script-src \'self\' \'unsafe-inline\'"'
        if production_branch not in text:
            errors.append(
                "web/proxy.ts is missing the production script-src policy."
            )

    main_path = ROOT / "engine" / "main.py"
    if "install_security(app)" not in main_path.read_text(encoding="utf-8"):
        errors.append("engine/main.py does not install ContextForge security.")

    print("=" * 72)
    print("ContextForge production security posture")
    print("=" * 72)

    if warnings:
        print("\nWARNINGS")
        for warning in warnings:
            print(f"  - {warning}")

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print(f"Allowed origins: {', '.join(origins)}")
    print(f"Max request bytes: {max_bytes}")
    print(f"Engine rate limit enabled: {rate_enabled}")
    print(f"Trusted forwarded IPs: {forwarded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
