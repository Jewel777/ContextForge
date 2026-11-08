from contextforge.services.hard_evidence_rescue import plan_targeted_hard_rescue


def item(index, facet_scores, *, hard=False, constraint=0, priority=0.7):
    return {
        "source_index": index,
        "facet_scores": facet_scores,
        "negative_terms": set(),
        "has_constraint": hard,
        "constraint_count": constraint,
        "evidence_strength": 0.25 if hard else 0.02,
        "has_number": hard,
        "priority_score": priority,
        "reranker_score": 0.75,
    }


def test_hard_evidence_rescue():
    facets = ["authentication", "database", "incident response", "disaster recovery"]

    selected = [
        item(1, {"authentication": 0.9}, hard=True, constraint=1),
        item(2, {"database": 0.9}, hard=True, constraint=1),
    ]

    scored = selected + [
        item(3, {"authentication": 0.88}, hard=True, constraint=1),
        item(4, {"authentication": 0.85}, hard=True, constraint=1),
        item(5, {"database": 0.87}, hard=True, constraint=1),
        item(6, {"database": 0.84}, hard=True, constraint=1),
        item(7, {"incident response": 0.91}, hard=True, constraint=1),
        item(8, {"incident response": 0.89}, hard=True, constraint=1),
        item(9, {"incident response": 0.86}, hard=True, constraint=1),
        item(10, {"disaster recovery": 0.92}, hard=True, constraint=1),
        item(11, {"disaster recovery": 0.90}, hard=True, constraint=1),
        item(12, {"disaster recovery": 0.88}, hard=True, constraint=1),
        # Distractor: no requested-facet support.
        item(13, {"authentication": 0.1, "database": 0.1}, hard=True, constraint=1),
    ]

    picks = plan_targeted_hard_rescue(
        scored=scored,
        selected=selected,
        facets=facets,
        min_hard_per_facet=3,
        min_facet_score=0.42,
        max_additions=18,
    )

    ids = {pick.source_index for pick in picks}

    assert 13 not in ids
    assert {3, 4, 5, 6, 7, 8, 9, 10, 11, 12} <= ids

    print("PASS - targeted hard-evidence rescue smoke test")
    print("picks:", [(p.source_index, p.facet) for p in picks])


if __name__ == "__main__":
    test_hard_evidence_rescue()
