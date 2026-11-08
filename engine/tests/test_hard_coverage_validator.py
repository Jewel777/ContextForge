from contextforge.services.hard_coverage_validator import validate_hard_evidence_coverage


def test_hard_coverage_validator():
    selected = [
        {
            "facet_scores": {"authentication": 0.91, "database": 0.10},
            "has_constraint": False,
            "constraint_count": 0,
            "has_number": False,
            "evidence_strength": 0.05,
            "negative_terms": set(),
        },
        {
            "facet_scores": {"authentication": 0.10, "database": 0.93},
            "has_constraint": True,
            "constraint_count": 1,
            "has_number": True,
            "evidence_strength": 0.30,
            "negative_terms": set(),
        },
    ]

    result = validate_hard_evidence_coverage(
        selected=selected,
        facets=["authentication", "database"],
    )

    assert result["semantic_coverage"] == {"covered": 2, "total": 2}
    assert result["hard_evidence_coverage"] == {"covered": 1, "total": 2}
    assert result["missing_hard_evidence_facets"] == ["authentication"]

    print("PASS - hard evidence coverage validator smoke test")
    print(result)


if __name__ == "__main__":
    test_hard_coverage_validator()
