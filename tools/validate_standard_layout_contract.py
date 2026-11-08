from pathlib import Path

ROOT = Path(r"D:\Prompt_engine")
TOOLS = ROOT / "tools"
PAGE = ROOT / "web" / "app" / "page.tsx"
PREFLIGHT = TOOLS / "run_deployment_preflight.ps1"

LEGACY = [
    "validate_standard_desktop_density.py",
    "validate_standard_two_column_ui.py",
    "validate_standard_workspace_finish.py",
    "validate_standard_inspector_sticky.py",
    "validate_standard_inspector_span.py",
    "validate_standard_row_span_layout.py",
    "validate_standard_inspector_grid_stretch.py",
    "validate_standard_full_height_inspector.py",
    "validate_standard_inspector_final.py",
]

page = PAGE.read_text(encoding="utf-8")
preflight = PREFLIGHT.read_text(encoding="utf-8")

checks = {
    "canonical workspace marker":
        "ContextForge Standard desktop workspace — canonical" in page,

    "Standard workspace preserved":
        'data-contextforge-standard-workspace="true"' in page,

    "Standard controls preserved":
        'data-contextforge-standard-controls="true"' in page,

    "Inspector preserved":
        'data-contextforge-inspector="true"' in page,

    "Trust Summary preserved":
        'data-contextforge-standard-trust-summary="true"' in page,

    "canonical final-layout validator exists":
        (TOOLS / "validate_standard_final_layout.py").exists(),

    "canonical page-scroll validator exists":
        (TOOLS / "validate_standard_inspector_scroll.py").exists(),

    "final-layout validator active":
        "validate_standard_final_layout.py" in preflight,

    "page-scroll validator active":
        "validate_standard_inspector_scroll.py" in preflight,

    "legacy validator calls removed":
        not any(name in preflight for name in LEGACY),

    "legacy validator files removed":
        not any((TOOLS / name).exists() for name in LEGACY),
}

print("=" * 72)
print("ContextForge canonical Standard-layout contract")
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
print("Standard layout now has one authoritative validation contract.")
print("Canonical behavior: final composition + page-owned scrolling.")
