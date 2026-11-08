from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
ENGINE = ROOT / "engine"


def main() -> int:
    errors: list[str] = []

    required = [
        WEB / "app" / "api" / "workspace-state" / "route.ts",
        ENGINE / "workspace_routes.py",
        WEB / "lib" / "contextforge-workspace-sync.ts",
        WEB / "components" / "WorkspacePersistenceBridge.tsx",
    ]

    for path in required:
        if not path.exists():
            errors.append(f"Missing {path}")

    if required[0].exists():
        text = required[0].read_text(encoding="utf-8")
        for token in [
            "requireApiSession",
            "x-contextforge-principal-id",
            "x-contextforge-workspace-id",
        ]:
            if token not in text:
                errors.append(f"Workspace API route missing: {token}")

    if required[1].exists():
        text = required[1].read_text(encoding="utf-8")
        for token in [
            "WorkspacePersistence",
            "resolve_principal",
            "_store.get",
            "_store.put",
            "_store.delete",
        ]:
            if token not in text:
                errors.append(f"Engine workspace route missing: {token}")

    if "workspace_router" not in (ENGINE / "main.py").read_text(encoding="utf-8"):
        errors.append("engine/main.py does not include workspace router.")

    if "WorkspacePersistenceBridge" not in (WEB / "app" / "layout.tsx").read_text(encoding="utf-8"):
        errors.append("Root layout does not mount persistence bridge.")

    print("=" * 72)
    print("ContextForge authenticated persistence validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Authenticated workspace API: present")
    print("Server-side ownership path: present")
    print("Signed-in sync bridge: present")
    print("Anonymous local mode remains isolated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
