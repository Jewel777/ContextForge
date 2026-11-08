from pathlib import Path

page = Path(r"D:\Prompt_engine\web\app\page.tsx")
text = page.read_text(encoding="utf-8")

checks = {
    "page-scroll policy installed":
        "/* Standard inspector page-scroll ownership */" in text,

    "Inspector overflow released":
        '[data-contextforge-inspector="true"]' in text
        and "overflow: visible !important;" in text,

    "internal vertical scroll removed":
        "overflow-y: visible !important;" in text,

    "scroll chaining restored":
        "overscroll-behavior-y: auto !important;" in text,

    "touch scrolling restored":
        "touch-action: auto !important;" in text,

    "Inspector no longer sticky":
        "position: static !important;" in text,

    "Trust Summary preserved":
        'data-contextforge-standard-trust-summary="true"' in text,
}

print("=" * 72)
print("ContextForge Standard Inspector scrolling validation")
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
print("Mouse-wheel scrolling belongs to the page in Standard mode.")
print("Context Inspector no longer traps vertical scrolling.")
print("Trust Summary remains preserved.")
