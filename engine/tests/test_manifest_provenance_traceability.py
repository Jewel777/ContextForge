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


def test_manifest_provenance_traceability():
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
    selected = manifest["selected"]
    metrics = manifest["metrics"]
    trust = manifest["trust"]

    assert selected, "Expected selected evidence."

    missing_provenance = [
        item
        for item in selected
        if item.get("source_id") is None
        and item.get("page") is None
    ]

    assert not missing_provenance, (
        "Selected text evidence is not traceable: "
        f"{missing_provenance}"
    )

    # source_index=0 must survive provenance serialization.
    source_ids = [
        item.get("source_id")
        for item in selected
    ]

    assert any(
        source_id == 0
        or source_id == "0"
        or str(source_id).startswith("0:")
        for source_id in source_ids
    ), (
        "First source unit provenance was lost: "
        f"{source_ids}"
    )

    assert metrics["provenance_coverage"] == 1.0, metrics
    assert metrics["critical_fact_recall"] == 1.0, metrics
    assert metrics["numeric_fact_recall"] == 1.0, metrics
    assert metrics["facet_coverage"] == 1.0, metrics
    assert metrics["hard_evidence_complete"] is True

    assert trust["state"] == "verified", trust
    assert trust["label"] == "Verified", trust
    assert trust["verified"] is True

    provenance_check = next(
        check
        for check in trust["checks"]
        if check["id"] == "provenance"
    )

    assert provenance_check["status"] == "pass"
    assert provenance_check["value"] == 1.0

    print("=" * 72)
    print("ContextForge provenance traceability validation")
    print("=" * 72)
    print("Selected evidence:", len(selected))
    print("Source IDs:", source_ids)
    print("Provenance coverage:", metrics["provenance_coverage"])
    print("Trust state:", trust["state"])
    print("Trust label:", trust["label"])
    print()
    print("RESULT: PASS")


if __name__ == "__main__":
    test_manifest_provenance_traceability()
