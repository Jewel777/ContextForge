from contextforge.services.context_manifest import build_context_manifest


def test_context_manifest():
    selected = [
        {
            "facet_scores": {"authentication": 0.91, "database": 0.10},
            "has_constraint": True,
            "constraint_count": 1,
            "has_number": True,
            "evidence_strength": 0.7,
            "negative_terms": set(),
            "evidence_type": "DEADLINE",
            "page": 2,
        },
        {
            "facet_scores": {"authentication": 0.08, "database": 0.92},
            "has_constraint": True,
            "constraint_count": 1,
            "has_number": True,
            "evidence_strength": 0.3,
            "negative_terms": set(),
            "evidence_type": "NUMERIC_CONSTRAINT",
            "page": 4,
        },
    ]

    manifest = build_context_manifest(
        selected=selected,
        facets=["authentication", "database"],
    )

    assert manifest["coverage"]["covered"] == 2
    assert manifest["coverage"]["total"] == 2
    assert manifest["coverage"]["hard_fact_covered"] == 2
    assert manifest["structured_constraint_count"] == 2
    assert manifest["numeric_evidence_count"] == 2
    assert manifest["pages_represented"] == [2, 4]
    assert manifest["explicit_negative_count"] == 0

    print("PASS - context manifest smoke test")
    print(manifest)


if __name__ == "__main__":
    test_context_manifest()
