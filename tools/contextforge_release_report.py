from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
WEB = ROOT / "web"
PYTHON = ENGINE / ".venv" / "Scripts" / "python.exe"
REPORTS = ROOT / "reports"

if not ROOT.exists():
    raise SystemExit(f"Missing project root: {ROOT}")
if not PYTHON.exists():
    raise SystemExit(f"Missing virtualenv Python: {PYTHON}")

REPORTS.mkdir(parents=True, exist_ok=True)

timestamp = datetime.now(timezone.utc)
stamp = timestamp.strftime("%Y%m%dT%H%M%SZ")

def run(name: str, command: list[str], cwd: Path) -> dict[str, Any]:
    print(f"\n{'=' * 68}")
    print(name)
    print('=' * 68)

    proc = subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        errors="replace",
        shell=False,
    )

    output = proc.stdout or ""
    print(output, end="" if output.endswith("\n") else "\n")
    passed = proc.returncode == 0
    print(f"[{'PASS' if passed else 'FAIL'}] {name}")

    return {
        "name": name,
        "passed": passed,
        "return_code": proc.returncode,
        "output": output,
    }

def first_match(text: str, patterns: list[str], cast=float):
    for pattern in patterns:
        match = re.search(pattern, text, re.I | re.M)
        if match:
            raw = match.group(1).strip()
            try:
                return cast(raw)
            except Exception:
                return raw
    return None

def extract_production_metrics(text: str) -> dict[str, Any]:
    metrics: dict[str, Any] = {}

    metrics["critical_fact_recall_pct"] = first_match(
        text,
        [
            r"critical(?:\s+fact)?\s+recall[^0-9]*(\d+(?:\.\d+)?)\s*%",
            r"critical[^:\n]*:\s*(\d+(?:\.\d+)?)\s*%",
        ],
    )
    metrics["numeric_fact_recall_pct"] = first_match(
        text,
        [
            r"numeric(?:\s+fact)?\s+recall[^0-9]*(\d+(?:\.\d+)?)\s*%",
            r"numeric[^:\n]*:\s*(\d+(?:\.\d+)?)\s*%",
        ],
    )
    metrics["distractor_rejection_pct"] = first_match(
        text,
        [
            r"distractor\s+rejection[^0-9]*(\d+(?:\.\d+)?)\s*%",
            r"distractor[^:\n]*:\s*(\d+(?:\.\d+)?)\s*%",
        ],
    )
    metrics["provenance_pct"] = first_match(
        text,
        [
            r"provenance[^0-9]*(\d+(?:\.\d+)?)\s*%",
            r"provenance[^:\n]*:\s*(\d+(?:\.\d+)?)\s*%",
        ],
    )
    metrics["context_reduction_pct"] = first_match(
        text,
        [
            r"context\s+reduction[^0-9]*(\d+(?:\.\d+)?)\s*%",
            r"reduction[^0-9]*(\d+(?:\.\d+)?)\s*%",
        ],
    )
    metrics["retrieval_confidence"] = first_match(
        text,
        [
            r"retrieval\s+confidence[^0-9]*(\d+(?:\.\d+)?)",
            r"confidence\s*=\s*(\d+(?:\.\d+)?)",
        ],
    )

    facet_match = re.search(
        r"(?:facet\s+coverage|facets?)[^0-9]*(\d+)\s*/\s*(\d+)",
        text,
        re.I,
    )
    if facet_match:
        metrics["facet_coverage"] = {
            "covered": int(facet_match.group(1)),
            "total": int(facet_match.group(2)),
        }
    else:
        metrics["facet_coverage"] = None

    critical_counts = re.search(
        r"critical[^0-9]*(\d+)\s*/\s*(\d+)",
        text,
        re.I,
    )
    if critical_counts:
        metrics["critical_fact_counts"] = {
            "recalled": int(critical_counts.group(1)),
            "total": int(critical_counts.group(2)),
        }

    numeric_counts = re.search(
        r"numeric[^0-9]*(\d+)\s*/\s*(\d+)",
        text,
        re.I,
    )
    if numeric_counts:
        metrics["numeric_fact_counts"] = {
            "recalled": int(numeric_counts.group(1)),
            "total": int(numeric_counts.group(2)),
        }

    strategy = first_match(
        text,
        [
            r"strategy\s*[.:=\s]+\s*([A-Za-z0-9_.+\-]+)",
        ],
        cast=str,
    )
    metrics["strategy"] = strategy

    result_match = re.search(r"\bRESULT\s*[:=]?\s*(PASS|FAIL)\b", text, re.I)
    metrics["benchmark_result"] = result_match.group(1).upper() if result_match else None

    return metrics

def extract_regression_summary(text: str) -> dict[str, Any]:
    cases = []
    pattern = re.compile(
        r"(?P<name>[A-Za-z0-9_.\-]+).*?"
        r"reduction\s*=\s*(?P<reduction>\d+(?:\.\d+)?)%"
        r".*?confidence\s*=\s*(?P<confidence>\d+(?:\.\d+)?)",
        re.I,
    )
    for match in pattern.finditer(text):
        cases.append(
            {
                "name": match.group("name"),
                "reduction_pct": float(match.group("reduction")),
                "confidence": float(match.group("confidence")),
            }
        )
    return {"cases": cases, "case_count": len(cases)}

git_diff = run(
    "Git diff check",
    ["git", "diff", "--check"],
    ROOT,
)

original = run(
    "Original retrieval regression",
    [str(PYTHON), "-m", "tests.evaluate_retrieval"],
    ENGINE,
)

extended = run(
    "Extended retrieval regression",
    [str(PYTHON), "-m", "tests.evaluate_retrieval_extended"],
    ENGINE,
)

production = run(
    "Production benchmark",
    [str(PYTHON), "-m", "tests.evaluate_production_benchmark"],
    ENGINE,
)

frontend = run(
    "Frontend production build",
    ["npm.cmd", "run", "build"],
    WEB,
)

def git_value(args: list[str]) -> str | None:
    proc = subprocess.run(
        ["git", *args],
        cwd=str(ROOT),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        encoding="utf-8",
        errors="replace",
    )
    value = (proc.stdout or "").strip()
    return value or None

status = git_value(["status", "--short"]) or ""
branch = git_value(["branch", "--show-current"])
commit = git_value(["rev-parse", "HEAD"])
commit_short = git_value(["rev-parse", "--short", "HEAD"])

checks = [git_diff, original, extended, production, frontend]
release_pass = all(item["passed"] for item in checks)

report = {
    "schema": "contextforge.release-report",
    "version": 1,
    "generated_at_utc": timestamp.isoformat(),
    "release_gate": "PASS" if release_pass else "FAIL",
    "repository": {
        "root": str(ROOT),
        "branch": branch,
        "commit": commit,
        "commit_short": commit_short,
        "working_tree_clean": not bool(status),
        "status_short": status.splitlines() if status else [],
    },
    "checks": {
        "git_diff_check": {
            "passed": git_diff["passed"],
            "return_code": git_diff["return_code"],
        },
        "original_retrieval_regression": {
            "passed": original["passed"],
            "return_code": original["return_code"],
            "summary": extract_regression_summary(original["output"]),
        },
        "extended_retrieval_regression": {
            "passed": extended["passed"],
            "return_code": extended["return_code"],
            "summary": extract_regression_summary(extended["output"]),
        },
        "production_benchmark": {
            "passed": production["passed"],
            "return_code": production["return_code"],
            "metrics": extract_production_metrics(production["output"]),
        },
        "frontend_production_build": {
            "passed": frontend["passed"],
            "return_code": frontend["return_code"],
        },
    },
}

json_path = REPORTS / f"release_report_{stamp}.json"
latest_json = REPORTS / "release_report_latest.json"

json_text = json.dumps(report, indent=2, ensure_ascii=False)
json_path.write_text(json_text, encoding="utf-8")
latest_json.write_text(json_text, encoding="utf-8")

metrics = report["checks"]["production_benchmark"]["metrics"]
facet = metrics.get("facet_coverage")
facet_text = (
    f'{facet["covered"]}/{facet["total"]}'
    if isinstance(facet, dict)
    else "not parsed"
)

md = f"""# ContextForge Release Report

- Generated: {report["generated_at_utc"]}
- Release gate: **{report["release_gate"]}**
- Branch: `{branch or "unknown"}`
- Commit: `{commit_short or "unknown"}`
- Working tree clean: **{report["repository"]["working_tree_clean"]}**

## Core checks

| Check | Result |
|---|---|
| Git diff check | {"PASS" if git_diff["passed"] else "FAIL"} |
| Original retrieval regression | {"PASS" if original["passed"] else "FAIL"} |
| Extended retrieval regression | {"PASS" if extended["passed"] else "FAIL"} |
| Production benchmark | {"PASS" if production["passed"] else "FAIL"} |
| Frontend production build | {"PASS" if frontend["passed"] else "FAIL"} |

## Production benchmark metrics

| Metric | Value |
|---|---:|
| Critical fact recall | {metrics.get("critical_fact_recall_pct") if metrics.get("critical_fact_recall_pct") is not None else "not parsed"}% |
| Numeric fact recall | {metrics.get("numeric_fact_recall_pct") if metrics.get("numeric_fact_recall_pct") is not None else "not parsed"}% |
| Distractor rejection | {metrics.get("distractor_rejection_pct") if metrics.get("distractor_rejection_pct") is not None else "not parsed"}% |
| Facet coverage | {facet_text} |
| Provenance | {metrics.get("provenance_pct") if metrics.get("provenance_pct") is not None else "not parsed"}% |
| Context reduction | {metrics.get("context_reduction_pct") if metrics.get("context_reduction_pct") is not None else "not parsed"}% |
| Retrieval confidence | {metrics.get("retrieval_confidence") if metrics.get("retrieval_confidence") is not None else "not parsed"} |
| Strategy | {metrics.get("strategy") or "not parsed"} |
| Benchmark result | {metrics.get("benchmark_result") or "not parsed"} |

## Interpretation

A release is considered safe only when all regression suites, the production benchmark, and the frontend production build pass. Metrics are extracted from the benchmark output without changing the compiler or retrieval logic.
"""

md_path = REPORTS / f"release_report_{stamp}.md"
latest_md = REPORTS / "release_report_latest.md"
md_path.write_text(md, encoding="utf-8")
latest_md.write_text(md, encoding="utf-8")

print("\n" + "=" * 68)
print("CONTEXTFORGE RELEASE REPORT")
print("=" * 68)
print(f"Gate:                  {'PASS' if release_pass else 'FAIL'}")
print(f"Commit:                {commit_short or 'unknown'}")
print(f"Working tree clean:    {not bool(status)}")
print(f"Critical fact recall:  {metrics.get('critical_fact_recall_pct')}")
print(f"Numeric fact recall:   {metrics.get('numeric_fact_recall_pct')}")
print(f"Distractor rejection:  {metrics.get('distractor_rejection_pct')}")
print(f"Facet coverage:        {facet_text}")
print(f"Provenance:            {metrics.get('provenance_pct')}")
print(f"Context reduction:     {metrics.get('context_reduction_pct')}")
print(f"Retrieval confidence:  {metrics.get('retrieval_confidence')}")
print(f"Strategy:              {metrics.get('strategy')}")
print()
print(f"JSON: {json_path}")
print(f"MD:   {md_path}")
print(f"Latest JSON: {latest_json}")
print(f"Latest MD:   {latest_md}")

if not release_pass:
    sys.exit(1)
