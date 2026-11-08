from __future__ import annotations

import re
import sys
from pathlib import Path

from contextforge.services.extractors import extract_file
from contextforge.services.retrieval import optimize_sentences


TASK = (
    "Extract all mandatory security, authentication, database, incident response, "
    "retention, deployment, and disaster-recovery requirements. Preserve exact "
    "numeric limits, deadlines, ports, token lifetimes, thresholds, and page "
    "references. Exclude office, cafeteria, parking, social, design, and other "
    "unrelated operational details."
)

MODE = "balanced"
TOKEN_BUDGET = 1000

# Each entry represents a planted production fact in the benchmark document.
# `patterns` are deliberately semantic-but-deterministic regex checks against
# selected evidence sentences; `page` is the required provenance.
FACTS = [
    # Authentication / security
    dict(id="auth_access_token_15m", facet="authentication", page=2, numeric=True,
         patterns=[r"access tokens? expire after 15 minutes"]),
    dict(id="auth_refresh_token_7d", facet="authentication", page=2, numeric=True,
         patterns=[r"refresh tokens? expire after 7 days"]),
    dict(id="auth_mfa_admin", facet="authentication", page=2, numeric=False,
         patterns=[r"mfa is required for administrator accounts"]),
    dict(id="auth_lockout_5_20", facet="authentication", page=2, numeric=True,
         patterns=[r"five failed login attempts.*locked for 20 minutes"]),
    dict(id="security_aes256", facet="security", page=5, numeric=False,
         patterns=[r"encrypted at rest using aes-256"]),
    dict(id="security_export_personal_device", facet="security", page=5, numeric=False,
         patterns=[r"database exports cannot be stored on personal devices"]),
    dict(id="security_access_manager_mfa", facet="security", page=5, numeric=False,
         patterns=[r"access to customer records requires manager approval and mfa"]),
    dict(id="security_audit_365d", facet="retention", page=5, numeric=True,
         patterns=[r"audit logs must be retained.*365 days"]),
    dict(id="security_deleted_backup_30d", facet="retention", page=5, numeric=True,
         patterns=[r"deleted customer records.*no more than 30 days"]),

    # Deployment / API
    dict(id="deploy_port_8001", facet="deployment", page=3, numeric=True,
         patterns=[r"production api listens on port 8001"]),
    dict(id="deploy_request_25mb", facet="deployment", page=3, numeric=True,
         patterns=[r"requests larger than 25 mb are rejected"]),
    dict(id="deploy_retry_3", facet="deployment", page=3, numeric=True,
         patterns=[r"allows three retry attempts"]),
    dict(id="deploy_health_migration_rollback", facet="deployment", page=3, numeric=False,
         patterns=[r"production releases require.*health check.*migration verification.*rollback readiness"]),
    dict(id="deploy_rollback_required", facet="deployment", page=10, numeric=False,
         patterns=[r"every production deployment must have a documented rollback procedure"]),
    dict(id="deploy_emergency_review_1d", facet="deployment", page=10, numeric=True,
         patterns=[r"retrospective review within one business day"]),
    dict(id="deploy_destructive_backup_24h", facet="deployment", page=10, numeric=True,
         patterns=[r"destructive schema migrations require a verified backup less than 24 hours old"]),

    # Database
    dict(id="db_pool_30", facet="database", page=4, numeric=True,
         patterns=[r"database pool is limited to 30 connections"]),
    dict(id="db_slow_5s", facet="database", page=4, numeric=True,
         patterns=[r"queries exceeding 5 seconds are logged as slow queries"]),
    dict(id="db_retry_3", facet="database", page=4, numeric=True,
         patterns=[r"failed database connections retry three times"]),
    dict(id="db_backup_2am", facet="database", page=4, numeric=True,
         patterns=[r"backups run every night at 2 am"]),
    dict(id="db_backup_retention_30d", facet="retention", page=4, numeric=True,
         patterns=[r"backup retention is 30 days"]),

    # Incident response / monitoring
    dict(id="incident_sev1", facet="incident response", page=6, numeric=False,
         patterns=[r"outage affecting authentication is classified as severity 1"]),
    dict(id="incident_page_immediately", facet="incident response", page=6, numeric=False,
         patterns=[r"severity 1 incidents require paging.*immediately"]),
    dict(id="incident_commander_10m", facet="incident response", page=6, numeric=True,
         patterns=[r"incident commander must be assigned within 10 minutes"]),
    dict(id="incident_status_30m", facet="incident response", page=6, numeric=True,
         patterns=[r"status updates must be published every 30 minutes"]),
    dict(id="incident_postmortem_5d", facet="incident response", page=6, numeric=True,
         patterns=[r"postmortem is required within five business days"]),
    dict(id="threshold_error_2pct", facet="incident response", page=7, numeric=True,
         patterns=[r"error rate exceeds 2\.0%.*two consecutive evaluation windows"]),
    dict(id="threshold_latency_850ms_10m", facet="incident response", page=7, numeric=True,
         patterns=[r"p95 response time remains above 850 ms for 10 minutes"]),
    dict(id="retention_metrics_14d", facet="retention", page=7, numeric=True,
         patterns=[r"high-resolution metrics are retained for 14 days"]),
    dict(id="retention_metrics_13mo", facet="retention", page=7, numeric=True,
         patterns=[r"aggregated metrics are retained for 13 months"]),
    dict(id="retention_delete_30d", facet="retention", page=8, numeric=True,
         patterns=[r"deletion requests must be completed within 30 calendar days"]),

    # Vendor/security requirements
    dict(id="vendor_incident_24h", facet="security", page=11, numeric=True,
         patterns=[r"critical vendors must notify.*security incident within 24 hours"]),
    dict(id="vendor_review_12mo", facet="security", page=11, numeric=True,
         patterns=[r"critical vendors are reassessed at least once every 12 months"]),

    # Disaster recovery
    dict(id="dr_rto_4h", facet="disaster recovery", page=12, numeric=True,
         patterns=[r"recovery time objective.*4 hours"]),
    dict(id="dr_rpo_15m", facet="disaster recovery", page=12, numeric=True,
         patterns=[r"recovery point objective.*15 minutes"]),
    dict(id="dr_failover_20m", facet="disaster recovery", page=12, numeric=True,
         patterns=[r"primary region is unavailable for more than 20 minutes"]),
    dict(id="dr_exercise_2yr", facet="disaster recovery", page=12, numeric=True,
         patterns=[r"disaster-recovery exercise is conducted twice per year"]),
]

DISTRACTORS = [
    r"cafeteria",
    r"visitor parking",
    r"stand-up",
    r"editor themes?",
    r"marketing dashboard",
    r"pizza",
    r"coffee machine",
    r"wellness newsletter",
    r"furniture requests?",
    r"lunch-and-learn",
    r"frontend logo",
    r"social events?",
    r"company picnic",
    r"office inventory",
    r"benchmark note",
    r"this document intentionally",
]

REQUIRED_FACETS = {
    "security",
    "authentication",
    "database",
    "incident response",
    "retention",
    "deployment",
    "disaster recovery",
}


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _matches(sentence: str, patterns: list[str]) -> bool:
    normalized = _norm(sentence)
    return all(re.search(pattern, normalized, re.IGNORECASE) for pattern in patterns)


def _find_fact(fact: dict, sources: list[dict]):
    for source in sources:
        sentence = source.get("sentence") or ""
        if _matches(sentence, fact["patterns"]):
            return source
    return None


def _find_fact_in_stage(fact: dict, stage_items: list[dict]):
    for item in stage_items:
        sentence = item.get("sentence") or ""
        if _matches(sentence, fact["patterns"]):
            return item
    return None


def _attrition_stage(fact: dict, trace: dict) -> str:
    if _find_fact_in_stage(fact, trace.get("selected", [])):
        return "selected"
    if _find_fact_in_stage(fact, trace.get("filtered_candidates", [])):
        return "packing"
    if _find_fact_in_stage(fact, trace.get("scored", [])):
        return "candidate_filter"
    if _find_fact_in_stage(fact, trace.get("chunk_pool", [])):
        return "sentence_scoring"
    return "chunk_retrieval"


def main() -> int:
    default_pdf = Path(__file__).resolve().parent / "data" / "ContextForge_Production_Benchmark.pdf"
    pdf_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else default_pdf

    if not pdf_path.exists():
        print("ERROR: benchmark PDF not found:")
        print(f"  {pdf_path}")
        print()
        print("Copy ContextForge_Production_Benchmark.pdf into:")
        print(f"  {default_pdf}")
        return 2

    items, extraction = extract_file(pdf_path.name, pdf_path.read_bytes())

    result = optimize_sentences(
        items=items,
        task=TASK,
        mode=MODE,
        token_budget=TOKEN_BUDGET,
    )

    sources = result.get("sources", [])
    retrieval_trace = result.get("retrieval_trace") or {}

    matched = []
    missed = []
    provenance_correct = 0

    for fact in FACTS:
        source = _find_fact(fact, sources)
        if source is None:
            missed.append(fact)
            continue

        matched.append(fact)
        if source.get("page") == fact["page"]:
            provenance_correct += 1

    numeric_facts = [fact for fact in FACTS if fact["numeric"]]
    numeric_matched = [
        fact for fact in numeric_facts
        if _find_fact(fact, sources) is not None
    ]

    covered_facets = {fact["facet"] for fact in matched}
    facet_coverage = len(covered_facets & REQUIRED_FACETS) / len(REQUIRED_FACETS)

    selected_text = "\n".join(source.get("sentence", "") for source in sources)
    selected_norm = _norm(selected_text)

    leaked_distractors = [
        pattern for pattern in DISTRACTORS
        if re.search(pattern, selected_norm, re.IGNORECASE)
    ]
    distractor_rejection = 1.0 - (len(leaked_distractors) / len(DISTRACTORS))

    fact_recall = len(matched) / len(FACTS)
    numeric_recall = len(numeric_matched) / len(numeric_facts)
    provenance_accuracy = provenance_correct / max(1, len(matched))
    reduction = float(result.get("context_reduction_percent", 0.0))

    manifest = result.get("context_manifest") or {}
    manifest_coverage = manifest.get("coverage") or {}
    hard_coverage = result.get("hard_evidence_coverage") or {}
    hard_summary = hard_coverage.get("hard_evidence_coverage") or {}
    missing_hard_facets = hard_coverage.get("missing_hard_evidence_facets") or []

    targets = {
        "critical_fact_recall": fact_recall >= 0.95,
        "numeric_recall": numeric_recall >= 1.00,
        "facet_coverage": facet_coverage >= 1.00,
        "distractor_rejection": distractor_rejection >= 0.90,
        "provenance_accuracy": provenance_accuracy >= 1.00,
        "context_reduction": reduction >= 50.0,
    }

    print()
    print("=" * 72)
    print("ContextForge Production Benchmark")
    print("=" * 72)
    print(f"PDF pages read ............. {extraction.get('pages_read', '?')}")
    print(f"Evidence selected .......... {len(sources)}")
    print(f"Critical fact recall ....... {fact_recall * 100:6.2f}%  ({len(matched)}/{len(FACTS)})")
    print(f"Numeric fact recall ........ {numeric_recall * 100:6.2f}%  ({len(numeric_matched)}/{len(numeric_facts)})")
    print(f"Facet coverage ............. {len(covered_facets & REQUIRED_FACETS)}/{len(REQUIRED_FACETS)}")
    print(f"Distractor rejection ....... {distractor_rejection * 100:6.2f}%")
    print(f"Provenance accuracy ........ {provenance_accuracy * 100:6.2f}%")
    print(f"Context reduction .......... {reduction:6.2f}%")
    print(f"Retrieval confidence ....... {result.get('retrieval_confidence', '?')}")
    print(f"Strategy ................... {result.get('processing_stats', {}).get('retrieval_strategy', '?')}")
    print(
        "Manifest coverage .......... "
        f"{manifest_coverage.get('covered', '?')}/{manifest_coverage.get('total', '?')}"
    )
    print(
        "Hard-evidence coverage ..... "
        f"{hard_summary.get('covered', '?')}/{hard_summary.get('total', '?')}"
    )
    if missing_hard_facets:
        print("Missing hard facets ........ " + ", ".join(missing_hard_facets))

    if missed:
        print()
        print("MISSED FACTS")
        for fact in missed:
            print(f"  - {fact['id']} [page {fact['page']}] [{fact['facet']}]")

    if missed and retrieval_trace:
        print()
        print("ATTRITION DIAGNOSIS")
        stage_counts = {}
        for fact in missed:
            stage = _attrition_stage(fact, retrieval_trace)
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            print(f"  - {fact['id']}: lost_at={stage}")

        print()
        print("ATTRITION SUMMARY")
        for stage in (
            "chunk_retrieval",
            "sentence_scoring",
            "candidate_filter",
            "packing",
        ):
            print(f"  {stage:18s} {stage_counts.get(stage, 0)}")

        print()
        print("TRACE SIZES")
        print(f"  chunk_pool ............... {len(retrieval_trace.get('chunk_pool', []))}")
        print(f"  scored ................... {len(retrieval_trace.get('scored', []))}")
        print(f"  filtered_candidates ...... {len(retrieval_trace.get('filtered_candidates', []))}")
        print(f"  selected ................. {len(retrieval_trace.get('selected', []))}")

    if leaked_distractors:
        print()
        print("DISTRACTOR LEAKS")
        for pattern in leaked_distractors:
            print(f"  - {pattern}")

    print()
    print("TARGETS")
    for name, passed in targets.items():
        print(f"  {'PASS' if passed else 'FAIL'}  {name}")

    passed = all(targets.values())

    print()
    print("=" * 72)
    print("RESULT:", "PASS" if passed else "FAIL")
    print("=" * 72)
    print()

    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
