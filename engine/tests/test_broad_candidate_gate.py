from contextforge.services.broad_candidate_gate import build_broad_candidate_gate


def item(index, facet, score, *, hard=False, negative=False):
    facets = [
        "security",
        "authentication",
        "database",
        "incident response",
        "retention",
        "deployment",
        "disaster recovery",
    ]

    return {
        "source_index": index,
        "facet_scores": {
            name: (score if name == facet else 0.08)
            for name in facets
        },
        "best_facet_score": score,
        "priority_score": score,
        "evidence_strength": 0.3 if hard else 0.04,
        "evidence_labels": ["REQUIREMENT"] if hard else ["BACKGROUND"],
        "constraint_count": 1 if hard else 0,
        "has_constraint": hard,
        "has_number": hard,
        "negative_terms": {"cafeteria"} if negative else set(),
    }


def test_broad_candidate_gate():
    facets = [
        "security",
        "authentication",
        "database",
        "incident response",
        "retention",
        "deployment",
        "disaster recovery",
    ]

    scored = []
    index = 0

    # Enough rows to trigger broad mode.
    for facet in facets:
        for n in range(10):
            scored.append(
                item(
                    index,
                    facet,
                    0.82 - n * 0.03,
                    hard=(n < 4),
                )
            )
            index += 1

    # Explicit distractor must not enter the gate.
    scored.append(item(index, "security", 0.90, hard=True, negative=True))
    distractor_index = index

    legacy = [scored[0], scored[10]]

    result = build_broad_candidate_gate(
        scored=scored,
        facets=facets,
        legacy_candidates=legacy,
        token_budget=1000,
    )

    ids = set(result.source_indexes)

    assert result.broad_mode
    assert distractor_index not in ids

    for facet in facets:
        assert any(
            item_["source_index"] in ids
            and item_["best_facet_score"] >= 0.30
            and item_["facet_scores"].get(facet, 0.0) >= 0.30
            for item_ in scored
        ), facet

    print("PASS - broad candidate gate smoke test")
    print(result)


if __name__ == "__main__":
    test_broad_candidate_gate()
