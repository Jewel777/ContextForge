from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

STORE = WEB / "lib" / "contextforge-conflicts.ts"
CENTER = WEB / "components" / "CloudConflictCenter.tsx"
SYNC = WEB / "lib" / "contextforge-workspace-sync.ts"
LAYOUT = WEB / "app" / "layout.tsx"


def main() -> int:
    errors: list[str] = []

    for path in [STORE, CENTER, SYNC, LAYOUT]:
        if not path.exists():
            errors.append(f"Missing {path}")

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1

    store = STORE.read_text(encoding="utf-8")
    center = CENTER.read_text(encoding="utf-8")
    sync = SYNC.read_text(encoding="utf-8")
    layout = LAYOUT.read_text(encoding="utf-8")

    checks = [
        ("recovery storage", "sessionStorage", store),
        ("conflict record", "CloudConflictRecord", store),
        ("cloud accept action", "acceptCloudConflict", center),
        ("local reapply action", "reapplyLocalConflict", center),
        ("conflict event listener", "contextforge:cloud-conflict", center),
        ("displaced local preservation", "saveCloudConflict", sync),
        ("resolution event", "contextforge:cloud-conflict-resolved", sync),
        ("reapply export", "export async function reapplyLocalConflict", sync),
        ("accept export", "export async function acceptCloudConflict", sync),
        ("layout mount", "<CloudConflictCenter />", layout),
    ]

    for label, token, text in checks:
        if token not in text:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge conflict recovery UX validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Conflict visibility: present")
    print("Displaced local recovery buffer: present")
    print("Keep-cloud action: present")
    print("Reapply-local action: present")
    print("Resolution events: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
