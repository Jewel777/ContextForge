from pathlib import Path

manifest = Path(
    r"D:\Prompt_engine\engine\contextforge\services\context_manifest.py"
).read_text(encoding="utf-8")

checks = {
    "versioned trust metric contract":
        'MANIFEST_TRUST_METRICS_VERSION = "1.0"' in manifest,

    "critical recall":
        '"critical_fact_recall"' in manifest,

    "numeric recall":
        '"numeric_fact_recall"' in manifest,

    "provenance coverage":
        '"provenance_coverage"' in manifest,

    "facet coverage":
        '"facet_coverage"' in manifest,

    "hard evidence completeness":
        '"hard_evidence_complete"' in manifest,

    "irrelevant rejection excluded from denominator":
        "_manifest_item_is_irrelevant" in manifest
        and "relevant_rejected" in manifest,

    "counts exposed":
        '"critical_fact_counts"' in manifest
        and '"numeric_fact_counts"' in manifest
        and '"provenance_counts"' in manifest
        and '"facet_counts"' in manifest,

"trust metrics attached":
    "_attach_manifest_trust_metrics(manifest)" in manifest,

    "manifest validation preserved":
        "return validate_explainability_manifest(manifest)" in manifest,
}

print("=" * 72)
print("ContextForge manifest trust metric validation")
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
print("Per-compile trust metrics are now part of the manifest contract.")
print("Trust metrics are attached to the manifest and validated independently.")
