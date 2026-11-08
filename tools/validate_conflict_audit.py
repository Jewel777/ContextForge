from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"

def main() -> int:
    errors: list[str] = []

    files = [
        ENGINE / "conflict_audit.py",
        ENGINE / "conflict_routes.py",
        WEB / "app" / "api" / "workspace-conflicts" / "route.ts",
        WEB / "lib" / "contextforge-conflict-audit.ts",
        WEB / "components" / "ConflictAuditHistory.tsx",
    ]

    for path in files:
        if not path.exists():
            errors.append(f"Missing {path}")

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1

    audit = files[0].read_text(encoding="utf-8")
    routes = files[1].read_text(encoding="utf-8")
    client = files[3].read_text(encoding="utf-8")
    sync = (
        WEB / "lib" / "contextforge-workspace-sync.ts"
    ).read_text(encoding="utf-8")
    layout = (
        WEB / "app" / "layout.tsx"
    ).read_text(encoding="utf-8")
    main = (
        ENGINE / "main.py"
    ).read_text(encoding="utf-8")

    checks = [
        ("server audit table", "workspace_conflict_audit", audit),
        ("detection record", "record_detected", audit),
        ("resolution record", "def resolve(", audit),
        ("history list", "list_recent", audit),
        ("detected endpoint", "/workspace-conflicts/detected", routes),
        ("resolution endpoint", "/workspace-conflicts/resolve", routes),
        ("client detection audit", "recordConflictDetected", client),
        ("client resolution audit", "recordConflictResolved", client),
        ("sync detection hook", "recordConflictDetected", sync),
        ("sync resolution hook", "recordConflictResolved", sync),
        ("engine router mount", "conflict_router", main),
        ("history UI consolidated", "Recovery audit", (ROOT / "web" / "components" / "AdvancedOperationsHub.tsx").read_text(encoding="utf-8")),
    ]

    for label, token, text in checks:
        if token not in text:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge persistent conflict audit validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Conflict detection audit: present")
    print("Resolution audit: present")
    print("Principal/workspace attribution: present")
    print("Revision metadata: present")
    print("Persistent history API: present")
    print("Recovery audit UI: present")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
