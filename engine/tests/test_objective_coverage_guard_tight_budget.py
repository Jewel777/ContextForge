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
        110,
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
def test_tight_budget_does_not_claim_incompatible_numeric_facet_coverage():
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
        100,
    )

    output = result["optimized_text"].lower()
    facet_coverage = result["facet_coverage"]

    assert "/v2/sync-stream" in output
    assert "march 31 2027" in output
    assert "x-service-auth" in output
    assert "120 rps" in output

    assert "4.5 mb" not in output
    assert facet_coverage["covered"] == 4
    assert facet_coverage["total"] == 5
    assert "payload size limit" not in facet_coverage["facets"]

def test_five_facet_coverage_reaches_full_coverage_at_exact_budget_boundary():
    items = [
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
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

    below_boundary = optimize_sentences(items, task, "balanced", 106)
    at_boundary = optimize_sentences(items, task, "balanced", 107)

    assert below_boundary["facet_coverage"]["covered"] == 4
    assert below_boundary["facet_coverage"]["total"] == 5

    assert at_boundary["facet_coverage"]["covered"] == 5
    assert at_boundary["facet_coverage"]["total"] == 5
    assert "4.5 mb" in at_boundary["optimized_text"].lower()

def test_retrieval_confidence_tracks_final_facet_coverage():
    items = [
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
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

    partial = optimize_sentences(items, task, "balanced", 100)
    complete = optimize_sentences(items, task, "balanced", 107)

    assert partial["facet_coverage"]["covered"] == 4
    assert complete["facet_coverage"]["covered"] == 5

    assert partial["retrieval_confidence"] == 71
    assert complete["retrieval_confidence"] == 74
    assert complete["retrieval_confidence"] > partial["retrieval_confidence"]

def test_context_manifest_uses_authoritative_final_facet_coverage():
    items = [
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
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

    result = optimize_sentences(items, task, "balanced", 100)

    assert result["facet_coverage"]["covered"] == 4
    assert result["context_manifest"]["coverage"]["covered"] == 4

    payload = next(
        entry
        for entry in result["context_manifest"]["facets"]
        if entry["facet"] == "payload size limit"
    )

    assert payload["covered"] is False

def test_api_trust_objective_coverage_uses_authoritative_final_coverage():
    from main import _attach_explainability_manifest

    items = [
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
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

    partial = _attach_explainability_manifest(
        optimize_sentences(items, task, "balanced", 100),
        task,
    )["explainability_manifest"]

    complete = _attach_explainability_manifest(
        optimize_sentences(items, task, "balanced", 107),
        task,
    )["explainability_manifest"]

    partial_objective = next(
        check
        for check in partial["trust"]["checks"]
        if check["id"] == "objective_coverage"
    )

    complete_objective = next(
        check
        for check in complete["trust"]["checks"]
        if check["id"] == "objective_coverage"
    )

    assert partial["trust"]["state"] == "review"
    assert partial_objective["status"] == "review"
    assert partial_objective["value"] == 0.8

    assert complete["trust"]["state"] == "verified"
    assert complete_objective["status"] == "pass"
    assert complete_objective["value"] == 1.0

def test_uncovered_manifest_facet_has_zero_support_counts():
    items = [
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
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

    result = optimize_sentences(items, task, "balanced", 100)

    payload = next(
        entry
        for entry in result["context_manifest"]["facets"]
        if entry["facet"] == "payload size limit"
    )

    assert payload["covered"] is False
    assert payload["evidence_count"] == 0
    assert payload["hard_evidence_count"] == 0
    assert payload["numeric_evidence_count"] == 0
    assert payload["constraint_count"] == 0

def test_manifest_hard_fact_counts_track_tight_budget_boundary():
    items = [
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
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

    partial = optimize_sentences(items, task, "balanced", 100)
    complete = optimize_sentences(items, task, "balanced", 107)

    assert partial["context_manifest"]["coverage"]["hard_fact_covered"] == 3
    assert complete["context_manifest"]["coverage"]["hard_fact_covered"] == 4

    assert partial["context_manifest"]["numeric_evidence_count"] == 2
    assert complete["context_manifest"]["numeric_evidence_count"] == 3

    assert partial["context_manifest"]["structured_constraint_count"] == 0
    assert complete["context_manifest"]["structured_constraint_count"] == 1

def test_selected_source_metadata_removes_incompatible_numeric_matched_facet():
    items = [
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
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

    result = optimize_sentences(items, task, "balanced", 100)

    rate_source = next(
        source
        for source in result["sources"]
        if "120 RPS" in source["sentence"]
    )

    assert "rate limits" in rate_source["matched_facets"]
    assert "payload size limit" not in rate_source["matched_facets"]

def test_ui_explainability_card_uses_sanitized_matched_facets():
    from main import _attach_explainability_manifest

    items = [
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
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

    result = _attach_explainability_manifest(
        optimize_sentences(items, task, "balanced", 100),
        task,
    )

    rate_card = next(
        card
        for card in result["explainability_manifest"]["selected"]
        if "120 RPS" in card["text"]
    )

    assert rate_card["matched_facets"] == ["rate limits"]
    assert "facet:rate limits" in rate_card["reasons"]
    assert "facet:payload size limit" not in rate_card["reasons"]

def test_payload_size_objective_keeps_size_constraint_and_rejects_format_noise():
    from contextforge.services.semantic_evidence_role_v2 import semantic_role_classifier

    task = (
        "Extract the new endpoint, deprecation date, authentication header, "
        "rate limits, and payload size limit. Exclude unrelated operational details."
    )

    texts = [
        "Payloads must be UTF-8 JSON",
        "may not exceed 4.5 MB uncompressed.",
    ]

    predictions = semantic_role_classifier.classify_many(
        task=task,
        evidence_texts=texts,
    )

    assert predictions[0].role == "IRRELEVANT"
    assert predictions[1].role == "REQUIRED"
    assert predictions[1].relevance >= 0.72

def test_unrelated_numeric_constraint_cannot_displace_requested_deprecation_date():
    from contextforge.services.retrieval import optimize_sentences

    items = [
        {
            "sentence": "Access tokens expire after 15 minutes.",
            "page": None,
            "section": None,
        },
        {
            "sentence": "The service will be deprecated on March 31 2027.",
            "page": None,
            "section": None,
        },
    ]

    result = optimize_sentences(
        items,
        "Extract the deprecation date. Exclude unrelated operational details.",
        "balanced",
        80,
    )

    text = result["optimized_text"]

    assert "March 31 2027" in text
    assert "15 minutes" not in text
    assert result["facet_coverage"]["covered"] == 1
    assert result["facet_coverage"]["total"] == 1

def test_final_benchmark_reaches_full_coverage_at_114_tokens():
    from contextforge.services.retrieval import optimize_sentences

    items = [
        {"sentence": "The new endpoint is /v2/sync-stream.", "page": None, "section": None},
        {"sentence": "The service will be deprecated on March 31 2027.", "page": None, "section": None},
        {"sentence": "Authentication uses the X-Service-Auth header with a Bearer JWT.", "page": None, "section": None},
        {"sentence": "The service allows 120 RPS per tenant with a burst threshold of 250 requests over 10 seconds.", "page": None, "section": None},
        {"sentence": "Payloads may not exceed 4.5 MB uncompressed UTF-8 JSON.", "page": None, "section": None},
        {"sentence": "Access tokens expire after 15 minutes.", "page": None, "section": None},
        {"sentence": "The cafeteria serves lunch at noon.", "page": None, "section": None},
    ]

    task = (
        "Extract the new endpoint, deprecation date, authentication header, "
        "rate limits, and payload size limit. Exclude unrelated operational details."
    )

    partial = optimize_sentences(items, task, "balanced", 113)
    full = optimize_sentences(items, task, "balanced", 114)

    assert partial["facet_coverage"]["covered"] == 4
    assert full["facet_coverage"]["covered"] == 5
    assert full["facet_coverage"]["total"] == 5
