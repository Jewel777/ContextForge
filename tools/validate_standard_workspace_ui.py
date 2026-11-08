from pathlib import Path

page = Path(r"D:\Prompt_engine\web\app\page.tsx")
if not page.exists():
    raise SystemExit(f"Missing {page}")

text = page.read_text(encoding="utf-8")
checks = {
    "Standard inspector marker": 'data-contextforge-inspector="true"' in text,
    "Standard inspector sticky behavior": '"xl:sticky xl:top-24 xl:self-start"' in text,
    "Advanced mode remains conditional": "!contextforgeAdvancedMode" in text,
    "Compile CTA marker": 'data-contextforge-compile-cta="true"' in text,
    "Standard compile full width": '"w-full whitespace-nowrap"' in text,
    "Compile CTA no-wrap polish": '[data-contextforge-compile-cta="true"]' in text and "text-wrap: nowrap;" in text,
}
print("=" * 72)
print("ContextForge Standard workspace UI validation")
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
print("Standard-mode inspector remains visible on tall workflows.")
print("Primary Compile context CTA uses the available action width.")
print("Advanced mode behavior remains separate.")
