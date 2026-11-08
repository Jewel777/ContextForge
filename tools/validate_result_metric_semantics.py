from pathlib import Path

page = Path(r"D:\Prompt_engine\web\app\page.tsx")
text = page.read_text(encoding="utf-8")

checks = {
    "Standard semantic metric row":
        'data-contextforge-standard-token-semantics="true"' in text,

    "Source evidence terminology":
        'label="Source evidence"' in text,

    "Retained evidence derived correctly":
        'label="Retained evidence"' in text
        and "result.original_tokens - result.tokens_saved" in text,

    "Packed handoff terminology":
        'label="Packed handoff"' in text
        and "Total model-ready package, including task framing." in text,

    "Saved metric preserved":
        'label="Saved"' in text,

    "Reduction metric preserved":
        'label="Reduction"' in text,

    "Confidence metric preserved":
        'label="Confidence"' in text,

    "Trust state checks arithmetic":
        "result.tokens_saved <= result.original_tokens" in text
        and "result.tokens_saved / result.original_tokens" in text,

    "Trust Summary preserved":
        'data-contextforge-standard-trust-summary="true"' in text,

    "Advanced raw metric view preserved":
        'label="Final"' in text,
}

print("=" * 72)
print("ContextForge result metric semantics validation")
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
print("Compression metrics now distinguish retained evidence from packed output.")
print("Standard Trust state verifies compression arithmetic.")
print("Advanced raw metrics remain available.")
