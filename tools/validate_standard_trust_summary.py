from pathlib import Path

text = Path(r"D:\Prompt_engine\web\app\page.tsx").read_text(encoding="utf-8")

checks = {
    "Standard Trust Summary":
        'data-contextforge-standard-trust-summary="true"' in text,

    "Standard-only visibility":
        "!contextforgeAdvancedMode" in text,

    "three-state trust model":
        "type StandardTrustState" in text
        and '"verified"' in text
        and '"limited"' in text
        and '"review"' in text,

    "trust label":
        "trustDecision.label" in text,

    "retrieval confidence":
        "Retrieval confidence" in text
        and "result.retrieval_confidence" in text,

    "context reduction":
        "Context reduction" in text
        and "result.reduction_percent" in text,

    "packed handoff":
        "Packed handoff" in text
        and "result.optimized_tokens" in text,

    "copy handoff action":
        "Copy compiled context" in text
        and "onClick={copyOutput}" in text,

    "evidence integrity":
        'data-contextforge-standard-trust-checks="true"' in text,

    "Advanced dashboard preserved":
        'data-contextforge-advanced="evidence-quality-dashboard"' in text,
}

print("=" * 72)
print("ContextForge Standard Trust Summary validation")
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
print("Three-state Standard Trust Summary is current.")
print("Packed handoff terminology is current.")
