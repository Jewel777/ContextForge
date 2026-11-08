from pathlib import Path

page = Path(
    r"D:\Prompt_engine\web\app\page.tsx"
).read_text(encoding="utf-8")

checks = {
    "backend Trust checks consumed":
        "Array.isArray(backendTrust?.checks)" in page,

    "backend check IDs consumed":
        "candidate.id" in page,

    "backend labels consumed":
        "candidate.label" in page,

    "backend statuses consumed":
        "candidate.status" in page,

    "backend values consumed":
        "candidate.value" in page,

    "pass status mapped":
        'candidate.status === "pass"' in page,

    "review status mapped":
        'candidate.status === "review"' in page,

    "unavailable maps to UI unknown":
        'candidate.status === "unavailable"' in page
        and '"unknown"' in page,

    "backend checks override local checks":
        "backendChecks.length > 0" in page
        and 'StandardTrustDecision["checks"]' in page,

    "legacy fallback preserved":
        ": localDecision.checks" in page,

    "backend verdict authority preserved":
        "state: backendState" in page
        and "label: backendLabel" in page,

    "visible integrity panel preserved":
        'data-contextforge-standard-trust-checks="true"' in page,

    "Advanced dashboard preserved":
        'data-contextforge-advanced="evidence-quality-dashboard"' in page,
}

print("=" * 72)
print("ContextForge backend-authoritative Trust checks UI")
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
print("Standard Evidence integrity now renders backend Trust checks.")
print("Frontend-derived checks remain only as legacy-response fallback.")
