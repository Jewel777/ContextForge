from contextforge.services.retrieval import optimize_sentences
from main import _attach_explainability_manifest


def test_rejected_evidence_manifest():
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
    manifest = result["explainability_manifest"]
    rejected = manifest["rejected"]

    marketing = [
        item for item in rejected
        if "marketing dashboard" in str(item.get("text") or "").lower()
    ]
    assert marketing, "Expected marketing-dashboard distractor in rejected evidence"
    assert "marketing dashboard" not in result["optimized_text"].lower()
    assert marketing[0].get("reasons"), "Rejected evidence must include a reason"

    print("PASS - rejected evidence explainability")
    print("rejected:", len(rejected))
    print("marketing reasons:", marketing[0].get("reasons"))


if __name__ == "__main__":
    test_rejected_evidence_manifest()
