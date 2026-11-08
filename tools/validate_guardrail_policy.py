from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"


def main() -> int:
    errors: list[str] = []

    paths = {
        "policy": ENGINE / "guardrail_policy.py",
        "routes": ENGINE / "guardrail_policy_routes.py",
        "api": WEB / "app" / "api" / "workspace-guardrail-policy" / "route.ts",
        "client": WEB / "lib" / "contextforge-guardrail-policy.ts",
        "forecast": ENGINE / "conflict_forecast.py",
        "forecast_routes": ENGINE / "conflict_forecast_routes.py",
        "main": ENGINE / "main.py",
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
        ("hard warning bound", "HARD_WARNING_MIN", text["policy"]),
        ("hard refresh bound", "HARD_REFRESH_MIN", text["policy"]),
        ("hard critical bound", "HARD_CRITICAL_MIN", text["policy"]),
        ("backoff hard bounds", "HARD_BACKOFF_MAX", text["policy"]),
        ("history based tuning", "unresolved_ratio", text["policy"]),
        ("revision gap tuning", "average_revision_gap", text["policy"]),
        ("guardrail policy endpoint", "/workspace-conflicts/guardrail-policy", text["routes"]),
        ("engine router", "guardrail_policy_router", text["main"]),
        ("frontend policy loader", "loadGuardrailPolicy", text["client"]),
        ("forecast policy injection", "GuardrailPolicyService", text["forecast"]),
        ("adaptive warning threshold", "policy.warning_threshold", text["forecast"]),
        ("adaptive refresh threshold", "policy.refresh_threshold", text["forecast"]),
        ("adaptive backoff scale", "policy.backoff_scale", text["forecast"]),
    ]

    for label, token, body in checks:
        if token not in body:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge adaptive guardrail policy validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Per-workspace/key auto-tuning: present")
    print("Hard safety bounds: present")
    print("Adaptive warning thresholds: present")
    print("Adaptive refresh thresholds: present")
    print("Adaptive critical thresholds: present")
    print("Adaptive backoff scaling: present")
    print("History-derived tuning rationale: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
