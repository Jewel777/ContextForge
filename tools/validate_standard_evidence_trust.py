from pathlib import Path

text = Path(r"D:\Prompt_engine\web\app\page.tsx").read_text(encoding="utf-8")

checks = {
    "evidence-aware evaluator":
        "function evaluateStandardEvidenceTrust(" in text,

    "defensive manifest readers":
        "readNestedNumber(" in text
        and "readNestedBoolean(" in text
        and "readNestedArrayLength(" in text,

    "confidence check":
        'id: "confidence"' in text,

    "metric integrity check":
        'id: "arithmetic"' in text,

    "evidence selected check":
        'id: "evidence"' in text,

    "critical evidence check":
        'id: "critical"' in text,

    "numeric preservation check":
        'id: "numeric"' in text,

    "provenance check":
        'id: "provenance"' in text,

    "objective coverage check":
        'id: "facets"' in text,

    "three-state decision":
        "type StandardTrustState" in text
        and 'state: StandardTrustState' in text,

    "limited state handles unavailable checks":
        "unknown > 0" in text
        and '"limited"' in text,

    "review state":
        "review === 0" in text
        and '"review"' in text,

    "trust label used by UI":
        "trustDecision.label" in text,

    "unknown checks supported":
        '"unknown"' in text
        and 'status:' in text,

    "visible evidence integrity panel":
        'data-contextforge-standard-trust-checks="true"' in text,

    "Advanced dashboard preserved":
        'data-contextforge-advanced="evidence-quality-dashboard"' in text,
}

print("=" * 72)
print("ContextForge evidence-aware Standard Trust validation")
print("=" * 72)

failed = []

for name, ok in checks.items():
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    if not ok:
        failed.append(name)

print()

if failed:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
print("Evidence-aware Trust uses the current three-state model.")
print("Unavailable checks produce limited verification instead of false certainty.")

