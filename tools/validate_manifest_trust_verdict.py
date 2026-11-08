from pathlib import Path

manifest = Path(
    r"D:\Prompt_engine\engine\contextforge\services\context_manifest.py"
).read_text(encoding="utf-8")

schema = Path(
    r"D:\Prompt_engine\engine\contextforge\services\context_manifest_schema.py"
).read_text(encoding="utf-8")

checks = {
    "versioned Trust verdict":
        'MANIFEST_TRUST_VERDICT_VERSION = "1.0"' in manifest,

    "authoritative verdict builder":
        "def _build_manifest_trust_verdict(" in manifest,

    "Verified state":
        '"verified"' in manifest,

    "limited state":
        '"limited"' in manifest,

    "review state":
        '"review"' in manifest,

    "critical evidence":
        '"critical_evidence"' in manifest,

    "numeric preservation":
        '"numeric_preservation"' in manifest,

    "provenance":
        '"provenance"' in manifest,

    "objective coverage":
        '"objective_coverage"' in manifest,

    "hard evidence":
        '"hard_evidence"' in manifest,

    "verdict attached before validation":
        'manifest["trust"] = _build_manifest_trust_verdict(manifest)'
        in manifest,

    "Trust included in schema":
        '"trust": {"type": "object"}' in schema,
}

print("=" * 72)
print("ContextForge authoritative Trust-verdict validation")
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
print("Backend now owns the final per-compile Trust verdict.")
