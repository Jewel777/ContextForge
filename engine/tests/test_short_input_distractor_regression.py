from contextforge.services.retrieval import optimize_sentences


def test_short_input_distractor_regression():
    sentences = [
        "JWT access tokens expire after 15 minutes.",
        "Refresh tokens expire after 7 days.",
        "MFA is required for administrative accounts.",
        "The marketing dashboard refreshes every 45 minutes.",
        "Database exports cannot be stored on personal devices.",
        "Every production deployment must have a documented rollback procedure.",
    ]

    items = [
        {"sentence": sentence, "page": None, "section": None}
        for sentence in sentences
    ]

    task = (
        "Extract all mandatory authentication, security, database, and deployment "
        "requirements. Preserve exact numeric limits and exclude unrelated operational details."
    )

    result = optimize_sentences(items, task, "balanced", 500)
    output = (result.get("optimized_text") or "").lower()

    required = [
        "jwt access tokens expire after 15 minutes",
        "refresh tokens expire after 7 days",
        "mfa is required for administrative accounts",
        "database exports cannot be stored on personal devices",
        "every production deployment must have a documented rollback procedure",
    ]

    for fact in required:
        assert fact in output, f"Missing required fact: {fact}"

    assert "marketing dashboard" not in output, (
        "Distractor leaked into optimized output: marketing dashboard"
    )

    print("PASS - short-input distractor regression")
    print("selected:", len(result.get("sources") or []))
    print(result.get("optimized_text"))


if __name__ == "__main__":
    test_short_input_distractor_regression()
