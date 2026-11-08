from contextforge.services.facet_optimizer import plan_facet_coverage


def item(facet_scores, *, priority=0.7, reranker=0.7, evidence=0.3, constraints=0):
    return {
        "facet_scores": facet_scores,
        "priority_score": priority,
        "reranker_score": reranker,
        "evidence_strength": evidence,
        "constraint_count": constraints,
        "negative_terms": set(),
    }


def test_facet_optimizer():
    facets = [
        "authentication",
        "database",
        "incident response",
        "disaster recovery",
    ]

    candidates = [
        item({"authentication": 0.92, "database": 0.10, "incident response": 0.08, "disaster recovery": 0.05}),
        item({"authentication": 0.88, "database": 0.12, "incident response": 0.06, "disaster recovery": 0.04}),
        item({"authentication": 0.12, "database": 0.90, "incident response": 0.10, "disaster recovery": 0.10}, constraints=1),
        item({"authentication": 0.10, "database": 0.08, "incident response": 0.91, "disaster recovery": 0.12}, constraints=1),
        item({"authentication": 0.08, "database": 0.10, "incident response": 0.12, "disaster recovery": 0.94}, constraints=2),
    ]

    picks = plan_facet_coverage(
        candidates=candidates,
        facets=facets,
        token_costs=[20, 20, 20, 20, 20],
        token_budget=100,
        max_per_facet=2,
    )

    covered = {pick.facet for pick in picks}

    assert covered == set(facets), (covered, picks)

    # The optimizer must not spend the whole budget on the two strongest auth
    # candidates while leaving other requested domains uncovered.
    first_four = {pick.facet for pick in picks[:4]}
    assert first_four == set(facets), first_four

    print("PASS - facet coverage optimizer smoke test")
    print("plan:", [(p.candidate_index, p.facet, round(p.marginal_gain, 3)) for p in picks])


if __name__ == "__main__":
    test_facet_optimizer()
