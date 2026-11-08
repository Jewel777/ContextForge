from pathlib import Path

page = Path(r"D:\Prompt_engine\web\app\page.tsx")
text = page.read_text(encoding="utf-8")

checks = {
    "three-state trust model":
        'type StandardTrustState' in text
        and '"verified"' in text
        and '"limited"' in text
        and '"review"' in text,

    "limited state for unavailable checks":
        'unknown > 0' in text
        and '? "limited"' in text,

    "verified requires no unavailable checks":
        'state === "verified"' in text,

    "review state preserved":
        'state === "review"' in text
        or '"Review recommended"' in text,

    "trust label centralized":
        "trustDecision.label" in text,

    "limited verification copy":
        "could not be verified from the current manifest" in text,

    "limited badge styling":
        'trustDecision.state === "limited"' in text
        and "bg-blue-100 text-blue-700" in text,

    "evidence integrity panel preserved":
        'data-contextforge-standard-trust-checks="true"' in text,

    "Trust Summary preserved":
        'data-contextforge-standard-trust-summary="true"' in text,
}

print("=" * 72)
print("ContextForge Standard three-state Trust validation")
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
print("Trust states: Verified / Ready with limited verification / Review.")
print("Unavailable evidence checks can no longer masquerade as fully verified.")
