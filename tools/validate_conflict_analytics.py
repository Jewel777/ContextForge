from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"


def main() -> int:
    errors: list[str] = []

    paths = {
        "analytics": ENGINE / "conflict_analytics.py",
        "routes": ENGINE / "conflict_analytics_routes.py",
        "api": WEB / "app" / "api" / "workspace-conflict-analytics" / "route.ts",
        "client": WEB / "lib" / "contextforge-conflict-analytics.ts",
        "component": WEB / "components" / "ConflictOperationalHealth.tsx",
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
        ("24h frequency", "conflicts_24h", text["analytics"]),
        ("7d frequency", "conflicts_7d", text["analytics"]),
        ("unresolved", "unresolved_conflicts", text["analytics"]),
        ("resolution ratio", "resolution_cloud_ratio", text["analytics"]),
        ("hot keys", "hot_keys", text["analytics"]),
        ("stale patterns", "repeated_stale_keys", text["analytics"]),
        ("daily trend", "trend_daily", text["analytics"]),
        ("health score", "health_score", text["analytics"]),
        ("analytics endpoint", "/workspace-conflicts/analytics", text["routes"]),
        ("engine router", "conflict_analytics_router", text["main"]),
        ("web API", "/workspace-conflicts/analytics", text["api"]),
        ("frontend loader", "loadConflictAnalytics", text["client"]),
        ("operational UI", "Cross-device conflict analytics", text["component"]),
        ("operations hub consolidation", "Conflict health", (WEB / "components" / "AdvancedOperationsHub.tsx").read_text(encoding="utf-8")),
    ]

    for label, token, body in checks:
        if token not in body:
            errors.append(f"Missing {label}: {token}")

    print("=" * 72)
    print("ContextForge conflict analytics validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("Conflict frequency analytics: present")
    print("Hot-key detection: present")
    print("Repeated stale-client patterns: present")
    print("Resolution ratios: present")
    print("Unresolved tracking: present")
    print("Workspace health scoring: present")
    print("Operational dashboard: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
