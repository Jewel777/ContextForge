from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Sequence

from .hybrid import BM25Index, reciprocal_rank_fusion


_HARD_SIGNAL_RE = re.compile(
    r"\b(?:must|shall|required|requires?|cannot|may not|prohibited|"
    r"limited to|no more than|at least|at most|within|expires?|"
    r"retained|retention|threshold|recovery time objective|"
    r"recovery point objective|rto|rpo|port|retry|retries|backup|"
    r"severity|incident commander|status update)\b|\d",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class BroadRecallPlan:
    chunk_indexes: tuple[int, ...]
    strategy: str
    global_count: int
    facet_added: int
    hard_signal_added: int
    total_count: int


def _rank_desc(scores: Sequence[float]) -> list[int]:
    return sorted(
        range(len(scores)),
        key=lambda index: (float(scores[index]), -index),
        reverse=True,
    )


def build_broad_recall_plan(
    *,
    chunk_texts: Sequence[str],
    queries: Sequence[str],
    semantic_scores_by_query: Sequence[Sequence[float]],
    base_chunk_indexes: Sequence[int],
    small_document_all_chunks: int = 96,
    per_facet_k: int = 8,
    hard_signal_semantic_floor: float = 0.22,
    max_large_document_chunks: int = 160,
) -> BroadRecallPlan:
    """
    Recall-first router for genuinely broad extraction tasks.

    Key design:
    - Small/medium documents: score ALL chunks. There is no reason to throw
      evidence away before the cross-encoder, evidence classifier, constraint
      extractor, and coverage optimizer see it.
    - Large documents: keep normal global retrieval, then union:
        * top dense+BM25 chunks per facet;
        * hard-signal chunks with plausible semantic support.
    - This component only controls what enters sentence scoring. It does not
      force any chunk into the final context.
    """
    chunk_count = len(chunk_texts)

    if chunk_count == 0:
        return BroadRecallPlan((), "empty", 0, 0, 0, 0)

    if len(queries) != len(semantic_scores_by_query):
        raise ValueError("queries and semantic score vectors must align")

    for scores in semantic_scores_by_query:
        if len(scores) != chunk_count:
            raise ValueError("semantic score vector length mismatch")

    base = {
        int(index)
        for index in base_chunk_indexes
        if 0 <= int(index) < chunk_count
    }

    # For a modest document, exhaustive chunk scoring is the correct recall
    # strategy. Later stages already exist to recover precision.
    if chunk_count <= small_document_all_chunks:
        all_indexes = tuple(range(chunk_count))
        return BroadRecallPlan(
            chunk_indexes=all_indexes,
            strategy="all_chunks_small_document",
            global_count=len(base),
            facet_added=max(0, chunk_count - len(base)),
            hard_signal_added=0,
            total_count=chunk_count,
        )

    bm25 = BM25Index(chunk_texts)
    chosen = set(base)
    facet_added = 0

    # queries[0] is the full task; queries[1:] are facets.
    for query_index, query in enumerate(queries[1:], start=1):
        dense = [float(v) for v in semantic_scores_by_query[query_index]]
        lexical = bm25.score(query)

        fused = reciprocal_rank_fusion(
            dense,
            lexical,
            dense_weight=1.0,
            lexical_weight=1.0,
            rrf_k=60,
        )

        kept = 0
        for chunk_index in _rank_desc(fused):
            # Require at least one real signal.
            if dense[chunk_index] < 0.20 and lexical[chunk_index] <= 0:
                continue

            if chunk_index not in chosen:
                chosen.add(chunk_index)
                facet_added += 1

            kept += 1
            if kept >= per_facet_k:
                break

    # Hard-evidence lane for exact limits/deadlines/ports/etc. This is still
    # only a routing signal; downstream ranking can reject irrelevant content.
    hard_signal_added = 0
    full_task_dense = semantic_scores_by_query[0]

    for chunk_index, chunk_text in enumerate(chunk_texts):
        if chunk_index in chosen:
            continue

        if not _HARD_SIGNAL_RE.search(chunk_text):
            continue

        best_semantic = max(
            float(scores[chunk_index])
            for scores in semantic_scores_by_query
        )

        if best_semantic < hard_signal_semantic_floor and float(full_task_dense[chunk_index]) < hard_signal_semantic_floor:
            continue

        chosen.add(chunk_index)
        hard_signal_added += 1

    # Bound pathological huge documents, while preserving all base/global
    # chunks and strongest routed additions.
    if len(chosen) > max_large_document_chunks:
        scores = []
        for chunk_index in chosen:
            best_semantic = max(
                float(query_scores[chunk_index])
                for query_scores in semantic_scores_by_query
            )
            scores.append((chunk_index, best_semantic))

        scores.sort(key=lambda pair: (pair[1], -pair[0]), reverse=True)

        protected = list(base)
        protected_set = set(protected)

        remaining = [
            index for index, _ in scores
            if index not in protected_set
        ]

        room = max(0, max_large_document_chunks - len(protected))
        chosen = protected_set | set(remaining[:room])

    ordered = tuple(sorted(chosen))

    return BroadRecallPlan(
        chunk_indexes=ordered,
        strategy="facet_union_hard_signal_large_document",
        global_count=len(base),
        facet_added=facet_added,
        hard_signal_added=hard_signal_added,
        total_count=len(ordered),
    )
