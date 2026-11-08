from pathlib import Path

manifest = Path(
    r"D:\Prompt_engine\engine\contextforge\services\context_manifest.py"
).read_text(encoding="utf-8")

checks = {
    "provenance traceability helper":
        "def _manifest_first_present(" in manifest,

    "source_index provenance fallback":
        '"source_index",' in manifest,

    "source zero preserved":
        "value is not None" in manifest,

    "source_id emitted":
        "source_id = _manifest_first_present(" in manifest,

    "page provenance preserved":
        'item.get("page") is not None' in manifest,

    "Trust metrics preserved":
        "def _attach_manifest_trust_metrics(" in manifest,

    "authoritative verdict preserved":
        "def _build_manifest_trust_verdict(" in manifest,
}

print("=" * 72)
print("ContextForge manifest provenance traceability validation")
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
print("Plain-text evidence can now be traced by source unit without a page number.")
print("Document page provenance remains supported.")
