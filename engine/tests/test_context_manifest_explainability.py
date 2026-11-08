from contextforge.services.context_manifest import build_explainability_manifest


def test_context_manifest_explainability():
    selected = [
        {
            "atom_id": "2:1",
            "sentence": "JWT access tokens expire after 15 minutes.",
            "page": 2,
            "best_facet": "authentication",
            "best_facet_score": 0.93,
            "evidence_type": "DEADLINE",
            "evidence_labels": ["DEADLINE", "SECURITY_CONTROL"],
            "mandatory": False,
            "hard": True,
            "has_number": True,
            "structured_constraints": [{"kind": "lifetime", "value": 15, "unit": "minutes"}],
            "semantic_role": "REQUIRED",
            "semantic_confidence": 0.91,
            "semantic_relevance": 1.0,
        },
        {
            "atom_id": "5:3",
            "sentence": "Production database exports cannot be stored on personal devices.",
            "page": 5,
            "best_facet": "database",
            "best_facet_score": 0.88,
            "evidence_type": "PROHIBITION",
            "evidence_labels": ["PROHIBITION", "SECURITY_CONTROL"],
            "mandatory": True,
            "hard": True,
            "has_number": False,
            "structured_constraints": [],
            "semantic_role": "PROHIBITED",
            "semantic_confidence": 0.56,
            "semantic_relevance": 0.94,
        },
    ]

    rejected = [
        {
            "atom_id": "3:9",
            "sentence": "The platform team holds a 9:30 AM stand-up three days per week.",
            "page": 3,
            "best_facet": "retention",
            "evidence_type": "NUMERIC_CONSTRAINT",
            "hard": False,
            "has_number": True,
            "semantic_role": "IRRELEVANT",
            "semantic_confidence": 1.0,
            "semantic_relevance": 0.0,
            "rejection_reason": "semantic_irrelevance_veto",
        }
    ]

    result = build_explainability_manifest(
        task="Extract mandatory security, authentication, and database requirements.",
        selected_evidence=selected,
        rejected_evidence=rejected,
        strategy="step16_plus_semantic_soft_veto",
        metrics={
            "critical_fact_recall": 1.0,
            "numeric_recall": 1.0,
            "distractor_rejection": 1.0,
        },
    )

    assert result["version"] == "2.0"
    assert result["summary"]["selected_count"] == 2
    assert result["summary"]["rejected_count"] == 1
    assert result["summary"]["facets_covered"] == ["authentication", "database"]
    assert result["summary"]["pages_used"] == [2, 5]
    assert result["selected"][0]["structured_constraints"][0]["value"] == 15
    assert "hard_evidence" in result["selected"][0]["reasons"]
    assert "mandatory" in result["selected"][1]["reasons"]
    assert result["rejected"][0]["semantic_role"] == "IRRELEVANT"
    assert "rejected:semantic_irrelevance_veto" in result["rejected"][0]["reasons"]

    print("PASS - Context Manifest explainability smoke test")
    print(result["summary"])


if __name__ == "__main__":
    test_context_manifest_explainability()
