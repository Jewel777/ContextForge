from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"


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


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    persistence_file = ENGINE / "persistence.py"
    auth_file = ENGINE / "auth_contract.py"

    for path in [persistence_file, auth_file]:
        if not path.exists():
            errors.append(f"Missing {path}")

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1

    env = load_env_file(ROOT / ".env.production")

    def get(name: str, default: str = "") -> str:
        return os.getenv(name, env.get(name, default)).strip()

    mode = get(
        "CONTEXTFORGE_AUTH_MODE",
        "disabled",
    ).lower()

    persistence_enabled = get(
        "CONTEXTFORGE_SERVER_PERSISTENCE_ENABLED",
        "false",
    ).lower() in {"1", "true", "yes", "on"}

    if persistence_enabled and mode == "disabled":
        errors.append(
            "Server persistence is enabled while authentication is disabled."
        )

    if mode not in {"disabled", "trusted_header"}:
        errors.append(
            f"Unsupported CONTEXTFORGE_AUTH_MODE={mode!r}"
        )

    if mode == "trusted_header":
        warnings.append(
            "trusted_header mode is only safe behind a trusted identity-aware "
            "reverse proxy that strips client-supplied identity headers."
        )

    persistence_text = persistence_file.read_text(encoding="utf-8")

    for required in [
        "owner_principal_id",
        "_assert_owner",
        "workspace_audit",
        "FOREIGN KEY",
        "ON DELETE CASCADE",
    ]:
        if required not in persistence_text:
            errors.append(
                "Persistence implementation missing tenant-safety feature: "
                + required
            )

    print("=" * 72)
    print("ContextForge server persistence foundation validation")
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
    print(f"Auth mode: {mode}")
    print(f"Server persistence enabled: {persistence_enabled}")
    print("Workspace owner enforcement contract: present")
    print("Workspace mutation audit contract: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
