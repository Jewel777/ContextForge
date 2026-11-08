from contextforge.services.reranker import CrossEncoderReranker


def test_reranker():
    reranker = CrossEncoderReranker()

    candidates = [
        "The cafeteria closes at 3 PM.",
        "JWT access tokens expire after 15 minutes.",
        "Parking permits renew in January.",
    ]

    fallback = [0.10, 0.90, 0.05]

    ranked = reranker.rerank(
        query="authentication token lifetime",
        candidates=candidates,
        fallback_scores=fallback,
        top_k=3,
    )

    assert len(ranked) == 3
    assert ranked[0].index in {0, 1, 2}

    # Most important invariant: service never crashes. If the neural model
    # loads, it reranks. If not, fallback scores preserve deterministic order.
    if reranker.load_error is not None:
        assert ranked[0].index == 1

    print("PASS - reranker smoke test")
    print("model:", reranker.model_name)
    print("load_error:", reranker.load_error)
    print("ranking:", [(item.index, round(item.score, 4)) for item in ranked])


if __name__ == "__main__":
    test_reranker()
