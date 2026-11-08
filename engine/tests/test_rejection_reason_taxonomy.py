from contextforge.services.retrieval import optimize_sentences
from main import _attach_explainability_manifest


def test_rejection_reason_taxonomy():
    sentences = [
        "JWT access tokens expire after 15 minutes.",
        "Refresh tokens expire after 7 days.",
        "MFA is required for administrative accounts.",
        "The marketing dashboard refreshes every 45 minutes.",
        "Database exports cannot be stored on personal devices.",
        "Every production deployment must have a documented rollback procedure.",
    ]
    items = [{"sentence": s, "page": None, "section": None} for s in sentences]
    task = (
        "Extract all mandatory authentication, security, database, and deployment "
        "requirements. Preserve exact numeric limits and exclude unrelated operational details."
    )

    result = optimize_sentences(items, task, "balanced", 500)
    result = _attach_explainability_manifest(result, task)

    rejected = result["explainability_manifest"]["rejected"]
    marketing = next(
        item for item in rejected
        if "marketing dashboard" in str(item.get("text") or "").lower()
    )

    reasons = marketing.get("reasons") or []

    assert reasons, "Rejected evidence has no rejection reason"
    assert any(
        reason in reasons
        for reason in (
            "semantic_veto",
            "excluded_by_task_scope",
            "not_selected_by_semantic_fact_compiler",
        )
    ), f"Expected causal rejection reason, got: {reasons}"

    assert not any(
        reason.startswith("evidence_type:")
        or reason.startswith("facet:")
        or reason == "numeric_evidence"
        for reason in reasons
    ), f"Descriptive labels leaked into rejection reasons: {reasons}"

    assert "marketing dashboard" not in result["optimized_text"].lower()

    print("PASS - rejection reason taxonomy")
    print("reasons:", reasons)
    print("stage:", marketing.get("rejection_stage"))
    print("semantic_role:", marketing.get("semantic_role"))


if __name__ == "__main__":
    test_rejection_reason_taxonomy()
