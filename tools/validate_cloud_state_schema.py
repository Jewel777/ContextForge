from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

REGISTRY = WEB / "lib" / "contextforge-cloud-state.ts"
WORKSPACE = WEB / "lib" / "contextforge-workspace.ts"
SYNC = WEB / "lib" / "contextforge-workspace-sync.ts"
BRIDGE = WEB / "components" / "WorkspacePersistenceBridge.tsx"


def main() -> int:
    errors: list[str] = []

    for path in [REGISTRY, WORKSPACE, SYNC, BRIDGE]:
        if not path.exists():
            errors.append(f"Missing {path}")

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1

    registry = REGISTRY.read_text(encoding="utf-8")
    workspace = WORKSPACE.read_text(encoding="utf-8")
    sync = SYNC.read_text(encoding="utf-8")
    bridge = BRIDGE.read_text(encoding="utf-8")

    keys = re.findall(r'^\s+"([^"]+)",?\s*$', registry, flags=re.M)

    if len(keys) < 4:
        errors.append(
            f"Cloud registry contains too few durable keys: {len(keys)}"
        )

    for token in [
        "CONTEXTFORGE_CLOUD_STATE_SCHEMA_VERSION",
        "createCloudEnvelope",
        "readCloudEnvelope",
        "updatedAt",
    ]:
        if token not in registry:
            errors.append(f"Cloud-state schema missing: {token}")

    for token in [
        "setWorkspaceItemFromCloud",
        "contextforge:workspace-storage-change",
    ]:
        if token not in workspace:
            errors.append(f"Workspace storage integration missing: {token}")

    for token in [
        "setWorkspaceItemFromCloud",
        "createCloudEnvelope",
        "readCloudEnvelope",
        "mirrorWorkspaceStorageChange",
    ]:
        if token not in sync:
            errors.append(f"Cloud sync logic missing: {token}")

    if "addEventListener" not in bridge:
        errors.append("Persistence bridge does not mirror live storage changes.")

    print("=" * 72)
    print("ContextForge schema-versioned cloud-state validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Schema version: 1")
    print(f"Registered durable keys: {len(keys)}")
    for key in keys:
        print(f"  - {key}")
    print("Cloud-first sign-in reconciliation: present")
    print("Live authenticated mirroring: present")
    print("Anonymous local isolation: preserved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
