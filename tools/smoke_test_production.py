from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request


def request_json(url: str, *, method: str = "GET", payload: dict | None = None):
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read().decode("utf-8", errors="replace")
        return response.status, body


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Smoke-test a deployed ContextForge instance."
    )
    parser.add_argument(
        "--web",
        default="http://127.0.0.1:3000",
        help="Public ContextForge web base URL",
    )
    args = parser.parse_args()

    base = args.web.rstrip("/")
    checks: list[tuple[str, bool, str]] = []

    try:
        status, body = request_json(f"{base}/api/health")
        checks.append(("web health", 200 <= status < 300, f"HTTP {status}"))
    except Exception as exc:
        checks.append(("web health", False, str(exc)))

    payload = {
        "text": (
            "JWT access tokens expire after 15 minutes.\n"
            "The marketing dashboard refreshes every 45 minutes.\n"
            "MFA is required for administrative accounts."
        ),
        "task": (
            "Extract mandatory authentication requirements and preserve exact "
            "numeric limits. Exclude unrelated operational details."
        ),
        "mode": "balanced",
        "budget": 500,
    }

    try:
        status, body = request_json(
            f"{base}/api/optimize-text",
            method="POST",
            payload=payload,
        )
        lowered = body.lower()
        ok = (
            200 <= status < 300
            and "15 minutes" in lowered
            and "mfa" in lowered
        )
        checks.append(("compile smoke test", ok, f"HTTP {status}"))
    except Exception as exc:
        checks.append(("compile smoke test", False, str(exc)))

    print("=" * 72)
    print("ContextForge production smoke test")
    print("=" * 72)

    failed = False
    for name, ok, detail in checks:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")
        failed = failed or not ok

    print("\nRESULT:", "FAIL" if failed else "PASS")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
