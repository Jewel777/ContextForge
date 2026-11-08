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


def test_manifest_trust_verdict():
    result = optimize_sentences(
        [
            {"sentence": text, "page": None, "section": None}
            for text in SOURCE
        ],
        TASK,
        "balanced",
        500,
    )

    result = _attach_explainability_manifest(result, TASK)

    manifest = result["explainability_manifest"]
    trust = manifest["trust"]

    assert trust["version"] == "1.0"
    assert trust["state"] in {"verified", "limited", "review"}
    assert trust["label"]
    assert isinstance(trust["checks"], list)
    assert len(trust["checks"]) == 5

    assert (
        trust["passed_count"]
        + trust["review_count"]
        + trust["unavailable_count"]
        == len(trust["checks"])
    )

    metrics = manifest["metrics"]

    if all(
        key in metrics
        for key in (
            "critical_fact_recall",
            "numeric_fact_recall",
            "provenance_coverage",
            "facet_coverage",
            "hard_evidence_complete",
        )
    ):
        assert trust["state"] == "verified", trust
        assert trust["verified"] is True

    print("=" * 72)
    print("ContextForge authoritative Trust verdict")
    print("=" * 72)
    print("State:", trust["state"])
    print("Label:", trust["label"])

    for check in trust["checks"]:
        print(
            f"{check['label']:<24}"
            f"{check['status']:<12}"
            f"{check.get('value')}"
        )

    print()
    print("RESULT: PASS")


if __name__ == "__main__":
    test_manifest_trust_verdict()
