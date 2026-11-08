from contextforge.services.retrieval import optimize_sentences


def test_objective_coverage_guard_rescues_missing_requested_facet_without_noise():
    items = [
        {
            "sentence": "The cafeteria serves lunch at noon.",
            "page": None,
            "section": None,
        },
        {
            "sentence": (
                "The new endpoint is /v2/sync-stream; "
                "the deprecation date is March 31 2027."
            ),
            "page": None,
            "section": None,
        },
        {
            "sentence": (
                "Authentication requires the X-Service-Auth header "
                "using a Bearer JWT."
            ),
            "page": None,
            "section": None,
        },
        {
            "sentence": (
                "The service allows 120 RPS per tenant with a burst "
                "threshold of 250 requests over 10 seconds."
            ),
            "page": None,
            "section": None,
        },
        {
            "sentence": (
                "Payloads must be UTF-8 JSON and may not exceed "
                "4.5 MB uncompressed."
            ),
            "page": None,
            "section": None,
        },
    ]

    task = (
        "Extract the new endpoint, deprecation date, authentication header, "
        "rate limits, and payload size limit. Exclude unrelated operational details."
    )

    result = optimize_sentences(
        items,
        task,
        "balanced",
        500,
    )

    output = result["optimized_text"].lower()

    assert "/v2/sync-stream" in output
    assert "march 31 2027" in output
    assert "x-service-auth" in output
    assert "120 rps" in output
    assert "250 requests" in output
    assert "4.5 mb" in output

    assert "cafeteria" not in output

    stats = result["processing_stats"]

    assert "objective_guard_added" in stats
    assert "objective_guard_facets" in stats