from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"


def main() -> int:
    errors: list[str] = []

    paths = {
        "service": ENGINE / "conflict_forecast.py",
        "routes": ENGINE / "conflict_forecast_routes.py",
        "api": WEB / "app" / "api" / "workspace-conflict-forecast" / "route.ts",
        "client": WEB / "lib" / "contextforge-conflict-forecast.ts",
        "component": WEB / "components" / "ConflictForecastGuardrail.tsx",
        "sync": WEB / "lib" / "contextforge-workspace-sync.ts",
        "main": ENGINE / "main.py",
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
        ("risk score", "risk_score", text["service"]),
        ("key-specific conflict pressure", "recent_key_conflicts_24h", text["service"]),
        ("contention share", "key_conflict_share", text["service"]),
        ("preventive refresh", "require_refresh", text["service"]),
        ("recommended backoff", "recommended_backoff_ms", text["service"]),
        ("forecast endpoint", "/workspace-conflicts/forecast", text["routes"]),
        ("engine router", "conflict_forecast_router", text["main"]),
        ("frontend evaluator", "evaluateConflictWriteRisk", text["client"]),
        ("write guardrail hook", "applyPreventiveConflictGuardrail", text["sync"]),
        ("server refresh hook", "await readRemote(key)", text["sync"]),
        ("forecast event", "contextforge:conflict-forecast", text["component"]),
        ("layout mount", "<ConflictForecastGuardrail />", text["layout"]),
    ]

    for label, token, body in checks:
        if token not in body:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge conflict forecasting validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Pre-write risk forecasting: present")
    print("Key-specific contention scoring: present")
    print("Preventive server revision refresh: present")
    print("Risk warning event: present")
    print("Recommended backoff metadata: present")
    print("Preventive guardrail UI: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
