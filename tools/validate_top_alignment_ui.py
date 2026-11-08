from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "web" / "app" / "page.tsx"

def main() -> int:
    text = PAGE.read_text(encoding="utf-8")
    backdrop = text.find(
        '<div className="pointer-events-none fixed inset-0 overflow-hidden">'
    )
    wrapper = text.find(
        '<div className="relative mx-auto w-[min(94vw,1480px)] px-4 py-5 sm:px-5 lg:px-6">'
    )
    header = text.find("<header", wrapper)
    onboarding = text.find(
        "{contextforgeBetaReady && contextforgeBetaOnboardingVisible ? (",
        header,
    )
    experience = text.find(
        '<div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Experience</div>',
        header,
    )

    checks = {
        "root marker": 'data-contextforge-root="true"' in text,
        "backdrop before content wrapper": 0 <= backdrop < wrapper,
        "header is first app surface": 0 <= wrapper < header,
        "onboarding moved below header": 0 <= header < onboarding,
        "experience selector moved below header": 0 <= header < experience,
        "obsolete root alignment override removed":
            "ContextForge root alignment:" not in text,
    }

    print("=" * 72)
    print("ContextForge top-alignment UI validation")
    print("=" * 72)

    failed = False
    for label, ok in checks.items():
        print(f"[{'PASS' if ok else 'FAIL'}] {label}")
        failed = failed or not ok

    print("\nRESULT:", "FAIL" if failed else "PASS")
    return 1 if failed else 0

if __name__ == "__main__":
    raise SystemExit(main())
