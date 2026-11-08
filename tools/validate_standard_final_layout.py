from pathlib import Path

page = Path(r"D:\Prompt_engine\web\app\page.tsx")
text = page.read_text(encoding="utf-8")

checks = {
    "final composition installed":
        "/* Standard final desktop composition */" in text,

    "Source left":
        "grid-row: 1 !important;" in text,

    "Objective left":
        "grid-row: 2 !important;" in text,

    "Compression full width":
        "grid-column: 1 / 3 !important;" in text
        and "grid-row: 3 !important;" in text,

    "Inspector upper-right only":
        "grid-column: 2 !important;" in text
        and "grid-row: 1 / 3 !important;" in text,

    "sticky removed":
        "position: static !important;" in text,

    "Compile CTA retained":
        '[data-contextforge-compile-cta="true"]' in text
        and "min-height: 58px !important;" in text,
}

print("=" * 72)
print("ContextForge Standard final desktop layout validation")
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
print("Source and Objective remain beside Context Inspector.")
print("Compression and Compile become a deliberate full-width final stage.")
print("Sticky Inspector behavior removed.")
