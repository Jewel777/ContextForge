from pathlib import Path

page = Path(
    r"D:\Prompt_engine\web\app\page.tsx"
).read_text(encoding="utf-8")

checks = {
    "clipboard API guarded":
        "navigator.clipboard?.writeText" in page,

    "legacy clipboard fallback present":
        'document.execCommand("copy")' in page,

    "temporary textarea fallback present":
        'document.createElement("textarea")' in page,

    "copy failure handled":
        "Could not copy to clipboard. Please copy the output manually." in page,

    "copy success toast preserved":
        "Copied ${outputTarget === \"raw\" ? \"context\" : outputTarget} format" in page,
}

print("=" * 72)
print("ContextForge clipboard fallback validation")
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
print("Clipboard copy supports both secure and insecure browser contexts.")