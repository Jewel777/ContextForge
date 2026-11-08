from contextforge.services.hybrid import BM25Index, rank_chunks_hybrid


def test_bm25_exact_numeric_and_identifier_recall():
    docs = [
        "The cafeteria closes at 3 PM and pizza is served on Fridays.",
        "JWT access tokens expire after 15 minutes.",
        "The recovery point objective RPO is 15 minutes.",
        "The API listens on port 8001.",
    ]

    index = BM25Index(docs)

    token_scores = index.score("JWT access token 15 minutes")
    assert token_scores[1] == max(token_scores)

    port_scores = index.score("port 8001")
    assert port_scores[3] == max(port_scores)


def test_rrf_keeps_dense_and_lexical_signals():
    docs = [
        "General authentication architecture overview.",
        "JWT access tokens expire after 15 minutes.",
        "Office parking permits renew in January.",
    ]
    queries = ["authentication token lifetime 15 minutes"]

    # Pretend the semantic model slightly prefers the generic overview.
    semantic = [[0.91, 0.86, 0.10]]

    ranked = rank_chunks_hybrid(
        chunk_texts=docs,
        queries=queries,
        semantic_scores_by_query=semantic,
        top_k=3,
    )

    indexes = [item.chunk_index for item in ranked]

    # Exact lexical evidence must remain at the top of the candidate set.
    assert indexes[0] in {0, 1}
    assert indexes.index(1) < indexes.index(2)
