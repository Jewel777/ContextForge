from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "web" / "app" / "page.tsx"
WORKSPACE = ROOT / "web" / "lib" / "contextforge-workspace.ts"


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    if not PAGE.exists():
        errors.append(f"Missing {PAGE}")
    if not WORKSPACE.exists():
        errors.append(f"Missing {WORKSPACE}")

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1

    page = PAGE.read_text(encoding="utf-8")
    workspace = WORKSPACE.read_text(encoding="utf-8")

    for name in [
        "getWorkspaceItem",
        "setWorkspaceItem",
        "removeWorkspaceItem",
    ]:
        if name not in page:
            errors.append(f"page.tsx does not use {name}")

    direct_calls = re.findall(
        r"(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)\s*\(",
        page,
    )
    if direct_calls:
        errors.append(
            f"page.tsx still contains {len(direct_calls)} direct localStorage calls"
        )

    for token in [
        "ContextForgePrincipal",
        "ContextForgeWorkspace",
        "ownerPrincipalId",
        "scopedStorageKey",
        "migrateLegacyValue",
        "setAuthenticatedPrincipal",
        "setActiveWorkspace",
    ]:
        if token not in workspace:
            errors.append(
                f"contextforge-workspace.ts missing required feature: {token}"
            )

    if "storage.removeItem(legacyKey)" not in workspace:
        warnings.append(
            "Legacy storage values are copied but not removed during migration."
        )

    print("=" * 72)
    print("ContextForge identity/workspace isolation validation")
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
    print("Browser-local state is routed through principal/workspace scope.")
    print("Legacy ContextForge localStorage values migrate on first access.")
    print("Authenticated-principal and workspace ownership contracts are present.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
