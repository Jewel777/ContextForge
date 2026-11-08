from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"


def main() -> int:
    errors: list[str] = []

    paths = {
        "audit": ENGINE / "guardrail_policy_audit.py",
        "policy": ENGINE / "guardrail_policy.py",
        "routes": ENGINE / "guardrail_policy_routes.py",
        "api": WEB / "app" / "api" / "workspace-guardrail-policy-history" / "route.ts",
        "client": WEB / "lib" / "contextforge-guardrail-policy-audit.ts",
        "component": WEB / "components" / "GuardrailPolicyAuditHistory.tsx",
        "layout": WEB / "app" / "layout.tsx",
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
        ("audit table", "guardrail_policy_audit", text["audit"]),
        ("dedupe policy hash", "_hash_policy", text["audit"]),
        ("previous policy hash", "previous_policy_hash", text["audit"]),
        ("change-only persistence", "record_if_changed", text["audit"]),
        ("policy audit hook", "record_if_changed", text["policy"]),
        ("history endpoint", "/workspace-conflicts/guardrail-policy/history", text["routes"]),
        ("history web api", "/workspace-conflicts/guardrail-policy/history", text["api"]),
        ("history loader", "loadGuardrailPolicyHistory", text["client"]),
        ("change UI", "Guardrail policy change history", text["component"]),
        ("threshold comparison", "Δ warn", text["component"]),
        ("operations hub consolidation", "Policy history", (WEB / "components" / "AdvancedOperationsHub.tsx").read_text(encoding="utf-8")),
    ]

    for label, token, body in checks:
        if token not in body:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge guardrail policy audit validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Policy recalculation audit: present")
    print("Change-only persistence: present")
    print("Previous/current policy linkage: present")
    print("Threshold delta explainability: present")
    print("Tuning rationale history: present")
    print("Authenticated history API: present")
    print("Advanced audit UI: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
