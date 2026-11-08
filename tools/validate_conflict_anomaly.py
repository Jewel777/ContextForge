from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"


def main() -> int:
    errors: list[str] = []

    paths = {
        "service": ENGINE / "conflict_anomaly.py",
        "routes": ENGINE / "conflict_anomaly_routes.py",
        "api": WEB / "app" / "api" / "workspace-conflict-anomalies" / "route.ts",
        "client": WEB / "lib" / "contextforge-conflict-anomaly.ts",
        "component": WEB / "components" / "ConflictAnomalyCenter.tsx",
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
        ("anomaly score", "anomaly_score", text["service"]),
        ("spike detection", "conflict_spike", text["service"]),
        ("revision-gap detection", "large_revision_gap", text["service"]),
        ("hot-key detection", "repeated_hot_key", text["service"]),
        ("root causes", "root_causes", text["service"]),
        ("remediation recommendations", "recommendations", text["service"]),
        ("anomaly endpoint", "/workspace-conflicts/anomalies", text["routes"]),
        ("engine router", "conflict_anomaly_router", text["main"]),
        ("web API", "/workspace-conflicts/anomalies", text["api"]),
        ("frontend loader", "loadConflictAnomalies", text["client"]),
        ("anomaly UI", "Conflict anomaly analysis", text["component"]),
        ("operations hub consolidation", "Anomaly score", (WEB / "components" / "AdvancedOperationsHub.tsx").read_text(encoding="utf-8")),
    ]

    for label, token, body in checks:
        if token not in body:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge conflict anomaly validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Conflict spike detection: present")
    print("Revision-gap anomaly detection: present")
    print("Hot-key contention detection: present")
    print("Root-cause inference: present")
    print("Severity scoring: present")
    print("Automated remediation recommendations: present")
    print("Advanced operational UI: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
