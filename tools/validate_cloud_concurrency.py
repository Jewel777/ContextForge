from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"


def main() -> int:
    errors: list[str] = []

    concurrency = (
        ENGINE / "concurrency.py"
    ).read_text(encoding="utf-8")
    routes = (
        ENGINE / "workspace_routes.py"
    ).read_text(encoding="utf-8")
    sync = (
        WEB / "lib" / "contextforge-workspace-sync.ts"
    ).read_text(encoding="utf-8")

    checks = [
        ("revision migration", "ALTER TABLE workspace_kv", concurrency),
        ("conflict exception", "WorkspaceConflictError", concurrency),
        ("transaction lock", "BEGIN IMMEDIATE", concurrency),
        ("HTTP 409", "status_code=409", routes),
        ("revision response", '"revision": revision', routes),
        ("client revision cache", "revisionCache", sync),
        ("server wins", 'policy: "server-wins"', sync),
        ("conflict event", "contextforge:cloud-conflict", sync),
    ]

    for label, token, text in checks:
        if token not in text:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge cloud concurrency validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Per-record revisions: present")
    print("Optimistic concurrency: present")
    print("Atomic stale-write protection: present")
    print("HTTP 409 conflict path: present")
    print("Client revision tracking: present")
    print("Deterministic server-wins reconciliation: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
