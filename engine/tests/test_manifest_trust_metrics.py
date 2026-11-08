from contextforge.services.retrieval import optimize_sentences
from main import _attach_explainability_manifest


SOURCE = [
    "JWT access tokens expire after 15 minutes.",
    "Refresh tokens expire after 7 days.",
    "MFA is required for administrative accounts.",
    "The marketing dashboard refreshes every 45 minutes.",
    "Database exports cannot be stored on personal devices.",
    "Every production deployment must have a documented rollback procedure.",
]

TASK = (
    "Extract all mandatory authentication, security, database, and deployment "
    "requirements. Preserve exact numeric limits and exclude unrelated operational details."
)


def test_manifest_trust_metrics():
    items = [
        {
            "sentence": sentence,
            "page": None,
            "section": None,
        }
        for sentence in SOURCE
    ]

    result = optimize_sentences(
        items,
        TASK,
        "balanced",
        500,
    )

    result = _attach_explainability_manifest(
        result,
        TASK,
    )

    manifest = result["explainability_manifest"]
    metrics = manifest["metrics"]

    required = (
        "trust_metrics_version",
        "critical_fact_recall",
        "numeric_fact_recall",
        "provenance_coverage",
        "facet_coverage",
        "hard_evidence_complete",
    )

    missing = [
        key
        for key in required
        if key not in metrics
    ]

    assert not missing, f"Missing trust metrics: {missing}"

    assert metrics["trust_metrics_version"] == "1.0"

    assert 0.0 <= metrics["critical_fact_recall"] <= 1.0
    assert 0.0 <= metrics["numeric_fact_recall"] <= 1.0
    assert 0.0 <= metrics["provenance_coverage"] <= 1.0
    assert 0.0 <= metrics["facet_coverage"] <= 1.0

    selected_text = "\n".join(
        item.get("text", "")
        for item in manifest.get("selected", [])
    ).lower()

    assert "marketing dashboard" not in selected_text

    rejected_marketing = [
        item
        for item in manifest.get("rejected", [])
        if "marketing dashboard" in str(item.get("text") or "").lower()
    ]

    assert rejected_marketing, (
        "Expected marketing distractor in rejected evidence."
    )

    assert metrics["numeric_fact_recall"] == 1.0, metrics
    assert metrics["critical_fact_recall"] == 1.0, metrics
    assert metrics["hard_evidence_complete"] is True
    assert manifest["hard_evidence_complete"] is True

    print("=" * 72)
    print("ContextForge manifest trust-metrics runtime validation")
    print("=" * 72)

    print(
        "Critical fact recall:",
        metrics["critical_fact_recall"],
        metrics["critical_fact_counts"],
    )

    print(
        "Numeric fact recall:",
        metrics["numeric_fact_recall"],
        metrics["numeric_fact_counts"],
    )

    print(
        "Provenance coverage:",
        metrics["provenance_coverage"],
        metrics["provenance_counts"],
    )

    print(
        "Facet coverage:",
        metrics["facet_coverage"],
        metrics["facet_counts"],
    )

    print(
        "Irrelevant rejected:",
        metrics["irrelevant_rejected_count"],
    )

    print(
        "Relevant rejected:",
        metrics["relevant_rejected_count"],
    )

    print("Hard evidence complete:", metrics["hard_evidence_complete"])
    print()
    print("RESULT: PASS")


if __name__ == "__main__":
    test_manifest_trust_metrics()
