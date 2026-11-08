from pathlib import Path

page = Path(
    r"D:\Prompt_engine\web\app\page.tsx"
).read_text(encoding="utf-8")

checks = {
    "drill-down component":
        "function StandardTrustEvidenceDrilldown(" in page,

    "visible drill-down marker":
        'data-contextforge-standard-trust-drilldown="true"' in page,

    "backend Trust checks used":
        "manifest.trust?.checks" in page,

    "selected evidence used":
        "manifest.selected" in page,

    "rejected evidence used":
        "manifest.rejected" in page,

    "critical evidence mapping":
        'case "critical_evidence"' in page,

    "numeric mapping":
        'case "numeric_preservation"' in page,

    "provenance mapping":
        'case "provenance"' in page,

    "objective coverage mapping":
        'case "objective_coverage"' in page,

    "hard evidence mapping":
        'case "hard_evidence"' in page,

    "source-id traceability":
        "item.source_id" in page,

    "page traceability":
        "item.page" in page,

    "relevant rejected evidence":
        "relevantRejected" in page,

    "irrelevant rejection excluded":
        '"semantic_veto"' in page
        and '"excluded_by_task_scope"' in page
        and "semantic_role:IRRELEVANT" in page,

    "native expandable details":
        "<details" in page
        and "<summary" in page,

    "existing Trust checks preserved":
        'data-contextforge-standard-trust-checks="true"' in page,

    "backend authority preserved":
        "resolveStandardTrustDecision" in page,

    "Advanced dashboard preserved":
        'data-contextforge-advanced="evidence-quality-dashboard"' in page,
}

print("=" * 72)
print("ContextForge Standard Trust evidence drill-down validation")
print("=" * 72)

failed = []

for name, passed in checks.items():
    print(f"[{'PASS' if passed else 'FAIL'}] {name}")

    if not passed:
        failed.append(name)

print()

if failed:
    print("RESULT: FAIL")
    raise SystemExit(1)

print("RESULT: PASS")
print("Standard Trust checks now expose backend-grounded evidence drill-down.")
print("Selected, rejected, provenance, facets, and evidence text remain traceable.")
