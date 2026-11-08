from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"


def main() -> int:
    errors: list[str] = []

    paths = {
        "override": ENGINE / "guardrail_policy_override.py",
        "policy": ENGINE / "guardrail_policy.py",
        "routes": ENGINE / "guardrail_policy_routes.py",
        "api": WEB / "app" / "api" / "workspace-guardrail-override" / "route.ts",
        "client": WEB / "lib" / "contextforge-guardrail-override.ts",
        "hub": WEB / "components" / "AdvancedOperationsHub.tsx",
    }

    for label, path in paths.items():
        if not path.exists():
            errors.append(f"Missing {label}: {path}")

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1

    text = {
        key: path.read_text(encoding="utf-8")
        for key, path in paths.items()
    }

    checks = [
        ("override table", "guardrail_policy_override", text["override"]),
        ("hard-bound clamping", "clamp_values", text["override"]),
        ("active override lookup", "get_active", text["override"]),
        ("manual override persistence", "set_override", text["override"]),
        ("override clear", "clear_override", text["override"]),
        ("policy override application", "override = self._override.get_active", text["policy"]),
        ("override route", "/workspace-conflicts/guardrail-policy/override", text["routes"]),
        ("frontend override client", "setGuardrailOverride", text["client"]),
        ("rollback source", '"rollback"', text["client"]),
        ("manual source", '"manual"', text["client"]),
        ("advanced policy controls", "Safe manual override", text["hub"]),
        ("rollback action", "Restore this policy", text["hub"]),
    ]

    for label, token, body in checks:
        if token not in body:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge guardrail rollback/override validation")
    print("=" * 72)

    if errors:
        print("\\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\\nRESULT: FAIL")
        return 1

    print("\\nRESULT: PASS")
    print("Audited policy rollback: present")
    print("Safe manual override: present")
    print("Hard safety clamping: present")
    print("Active override application: present")
    print("Override clear/re-enable auto tuning: present")
    print("Advanced policy controls: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
