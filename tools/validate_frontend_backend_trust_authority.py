from pathlib import Path

page = Path(
    r"D:\Prompt_engine\web\app\page.tsx"
).read_text(encoding="utf-8")

checks = {
    "backend authority resolver":
        "function resolveStandardTrustDecision(" in page,

    "manifest Trust consumed":
        "manifest?.trust" in page,

    "Verified consumed":
        'backendTrust?.state === "verified"' in page,

    "limited consumed":
        'backendTrust?.state === "limited"' in page,

    "review consumed":
        'backendTrust?.state === "review"' in page,

    "backend label consumed":
        "label: backendLabel" in page,

    "backend state consumed":
        "state: backendState" in page,

    "UI uses authority resolver":
        "const trustDecision = resolveStandardTrustDecision(result);" in page,

    "legacy evaluator retained only as fallback/diagnostics":
        "const localDecision = evaluateStandardEvidenceTrust(result);" in page
        and "return localDecision;" in page,

    "Trust Summary preserved":
        'data-contextforge-standard-trust-summary="true"' in page,

    "evidence integrity preserved":
        'data-contextforge-standard-trust-checks="true"' in page,

    "Advanced dashboard preserved":
        'data-contextforge-advanced="evidence-quality-dashboard"' in page,
}

print("=" * 72)
print("ContextForge frontend backend-Trust authority validation")
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
print("Standard mode now renders the engine's authoritative Trust state.")
print("Local Trust evaluation remains only as backward-compatible fallback.")
