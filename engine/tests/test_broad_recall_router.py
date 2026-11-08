from contextforge.services.broad_recall_router import build_broad_recall_plan


def test_broad_recall_router():
    chunks = [
        "JWT access tokens expire after 15 minutes.",
        "The database pool is limited to 30 connections.",
        "Severity 1 incidents require paging immediately.",
        "The RTO is 4 hours and RPO is 15 minutes.",
        "Audit logs must be retained for 365 days.",
        "The cafeteria serves pizza on Fridays.",
    ]

    queries = [
        "security authentication database incident response retention disaster recovery",
        "authentication",
        "database",
        "incident response",
        "retention",
        "disaster recovery",
    ]

    semantic = [
        [0.80, 0.72, 0.70, 0.69, 0.67, 0.05],
        [0.95, 0.10, 0.08, 0.06, 0.05, 0.04],
        [0.08, 0.96, 0.12, 0.08, 0.08, 0.05],
        [0.08, 0.11, 0.95, 0.10, 0.08, 0.04],
        [0.07, 0.10, 0.08, 0.08, 0.94, 0.05],
        [0.08, 0.09, 0.10, 0.96, 0.07, 0.03],
    ]

    plan = build_broad_recall_plan(
        chunk_texts=chunks,
        queries=queries,
        semantic_scores_by_query=semantic,
        base_chunk_indexes=[0],
        small_document_all_chunks=96,
    )

    assert plan.strategy == "all_chunks_small_document"
    assert set(plan.chunk_indexes) == set(range(len(chunks)))

    print("PASS - broad recall router smoke test")
    print(plan)


if __name__ == "__main__":
    test_broad_recall_router()
