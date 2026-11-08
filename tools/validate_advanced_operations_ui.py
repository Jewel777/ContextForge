from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

LAYOUT = WEB / "app" / "layout.tsx"
HUB = WEB / "components" / "AdvancedOperationsHub.tsx"


def main() -> int:
    errors: list[str] = []

    for path in [LAYOUT, HUB]:
        if not path.exists():
            errors.append(f"Missing {path}")

    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1

    layout = LAYOUT.read_text(encoding="utf-8")
    hub = HUB.read_text(encoding="utf-8")

    checks = [
        ("unified operations hub", "Operations & Reliability", hub),
        ("advanced-only detection", "isAdvancedExperience", hub),
        ("health tab", '"health"', hub),
        ("anomalies tab", '"anomalies"', hub),
        ("recovery audit tab", '"audit"', hub),
        ("policy history tab", '"policy"', hub),
        ("layout mount", "<AdvancedOperationsHub />", layout),
    ]

    for label, token, text in checks:
        if token not in text:
            errors.append(f"Missing {label}: {token}")

    forbidden = [
        "<ConflictAuditHistory />",
        "<ConflictOperationalHealth />",
        "<ConflictAnomalyCenter />",
        "<GuardrailPolicyAuditHistory />",
    ]

    for token in forbidden:
        if token in layout:
            errors.append(
                f"Legacy floating control still mounted globally: {token}"
            )

    print("=" * 72)
    print("ContextForge Advanced operations UI validation")
    print("=" * 72)

    if errors:
        print("\\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\\nRESULT: FAIL")
        return 1

    print("\\nRESULT: PASS")
    print("Legacy floating Advanced controls removed from global layout")
    print("Unified Operations & Reliability hub: present")
    print("Advanced-only visibility guard: present")
    print("Conflict health: consolidated")
    print("Anomaly analysis: consolidated")
    print("Recovery audit: consolidated")
    print("Policy history: consolidated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
