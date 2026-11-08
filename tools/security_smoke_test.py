from __future__ import annotations

import argparse
import urllib.request

REQUIRED_HEADERS = {
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "permissions-policy",
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify ContextForge public security headers."
    )
    parser.add_argument(
        "--web",
        default="http://127.0.0.1:3000",
        help="Public ContextForge web base URL",
    )
    args = parser.parse_args()

    url = args.web.rstrip("/") + "/"
    request = urllib.request.Request(
        url,
        method="GET",
        headers={"User-Agent": "ContextForge-Security-Smoke/1.0"},
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            headers = {
                key.lower(): value
                for key, value in response.headers.items()
            }
            status = response.status
    except Exception as exc:
        print(f"[FAIL] GET {url}: {exc}")
        return 1

    missing = sorted(REQUIRED_HEADERS - set(headers))

    print("=" * 72)
    print("ContextForge public security smoke test")
    print("=" * 72)
    print(f"HTTP status: {status}")

    if missing:
        print("[FAIL] Missing headers:")
        for header in missing:
            print(f"  - {header}")
        print("\nRESULT: FAIL")
        return 1

    print("[PASS] Required browser security headers present.")
    print("\nRESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
