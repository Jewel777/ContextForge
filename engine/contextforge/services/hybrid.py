from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Sequence


_TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:/%-]*")


def _tokens(text: str) -> list[str]:
    return [m.group(0).lower() for m in _TOKEN_RE.finditer(text)]


@dataclass(frozen=True)
class HybridRankedChunk:
    chunk_index: int
    hybrid_score: float
    rrf_score: float
    dense_rank: int
    bm25_rank: int
    dense_score: float
    bm25_score: float


class BM25Index:
    """
    Small dependency-free BM25 implementation for ContextForge retrieval.

    The index is intentionally local/in-memory because retrieval.py already
    works on a bounded set of document chunks. This avoids introducing a
    search-server dependency while giving exact terms, identifiers, numbers,
    units, ports, acronyms, and policy vocabulary a first-class retrieval path.
    """

    def __init__(
        self,
        documents: Sequence[str],
        *,
        k1: float = 1.5,
        b: float = 0.75,
    ) -> None:
        self.k1 = float(k1)
        self.b = float(b)
        self.doc_tokens = [_tokens(doc) for doc in documents]
        self.doc_lengths = [len(tokens) for tokens in self.doc_tokens]
        self.avg_doc_len = (
            sum(self.doc_lengths) / len(self.doc_lengths)
            if self.doc_lengths
            else 0.0
        )

        self.term_freqs = [Counter(tokens) for tokens in self.doc_tokens]
        document_frequency: Counter[str] = Counter()

        for tf in self.term_freqs:
            document_frequency.update(tf.keys())

        self.document_frequency = document_frequency
        self.document_count = len(self.doc_tokens)

    def _idf(self, term: str) -> float:
        if self.document_count == 0:
            return 0.0

        df = self.document_frequency.get(term, 0)
        # Robertson/Sparck Jones IDF with +1 to keep the value positive.
        return math.log(
            1.0
            + (
                (self.document_count - df + 0.5)
                / (df + 0.5)
            )
        )

    def score(self, query: str) -> list[float]:
        if not self.doc_tokens:
            return []

        query_terms = _tokens(query)
        if not query_terms:
            return [0.0] * self.document_count

        unique_query_terms = Counter(query_terms)
        scores: list[float] = []

        for doc_index, tf in enumerate(self.term_freqs):
            doc_len = self.doc_lengths[doc_index]
            score = 0.0

            for term, query_count in unique_query_terms.items():
                frequency = tf.get(term, 0)
                if frequency <= 0:
                    continue

                idf = self._idf(term)
                length_norm = (
                    1.0 - self.b
                    + self.b * (
                        doc_len / self.avg_doc_len
                        if self.avg_doc_len > 0
                        else 0.0
                    )
                )
                denominator = frequency + self.k1 * length_norm
                tf_weight = (
                    frequency * (self.k1 + 1.0) / denominator
                    if denominator > 0
                    else 0.0
                )

                # Query repetition has a very small bounded effect.
                query_weight = 1.0 + min(0.20, 0.05 * (query_count - 1))
                score += idf * tf_weight * query_weight

            scores.append(score)

        return scores


def _ranks_desc(scores: Sequence[float]) -> list[int]:
    order = sorted(
        range(len(scores)),
        key=lambda index: (scores[index], -index),
        reverse=True,
    )
    ranks = [0] * len(scores)

    for rank, index in enumerate(order, start=1):
        ranks[index] = rank

    return ranks


def reciprocal_rank_fusion(
    dense_scores: Sequence[float],
    lexical_scores: Sequence[float],
    *,
    rrf_k: int = 60,
    dense_weight: float = 1.0,
    lexical_weight: float = 1.0,
) -> list[float]:
    """
    Fuse dense and lexical rankings without assuming their raw score scales
    are comparable.
    """
    if len(dense_scores) != len(lexical_scores):
        raise ValueError("Dense and lexical score arrays must have equal length.")

    dense_ranks = _ranks_desc(dense_scores)
    lexical_ranks = _ranks_desc(lexical_scores)

    return [
        dense_weight / (rrf_k + dense_ranks[i])
        + lexical_weight / (rrf_k + lexical_ranks[i])
        for i in range(len(dense_scores))
    ]


def rank_chunks_hybrid(
    *,
    chunk_texts: Sequence[str],
    queries: Sequence[str],
    semantic_scores_by_query: Sequence[Sequence[float]],
    top_k: int,
    dense_weight: float = 1.0,
    lexical_weight: float = 1.0,
    rrf_k: int = 60,
) -> list[HybridRankedChunk]:
    """
    Rank chunks using dense retrieval + BM25 + Reciprocal Rank Fusion.

    `semantic_scores_by_query[q][chunk]` is supplied by the existing
    sentence-transformer path. BM25 independently indexes the same chunks.

    For multi-facet tasks, each chunk receives its best semantic rank and best
    lexical rank across the full task and its facets. This improves recall for
    exact facts without throwing away semantic matching.
    """
    if not chunk_texts:
        return []

    if not queries:
        raise ValueError("At least one retrieval query is required.")

    chunk_count = len(chunk_texts)

    if len(semantic_scores_by_query) != len(queries):
        raise ValueError(
            "semantic_scores_by_query must have one score vector per query."
        )

    for scores in semantic_scores_by_query:
        if len(scores) != chunk_count:
            raise ValueError(
                "Every semantic score vector must match the chunk count."
            )

    bm25 = BM25Index(chunk_texts)
    lexical_scores_by_query = [bm25.score(query) for query in queries]

    # Dense and lexical channels each get their best query-specific signal.
    dense_best = [
        max(scores[chunk_index] for scores in semantic_scores_by_query)
        for chunk_index in range(chunk_count)
    ]
    lexical_best = [
        max(scores[chunk_index] for scores in lexical_scores_by_query)
        for chunk_index in range(chunk_count)
    ]

    dense_ranks = _ranks_desc(dense_best)
    lexical_ranks = _ranks_desc(lexical_best)

    rrf_scores = reciprocal_rank_fusion(
        dense_best,
        lexical_best,
        rrf_k=rrf_k,
        dense_weight=dense_weight,
        lexical_weight=lexical_weight,
    )

    # Tiny normalized raw-score tie breaker. RRF remains the main signal.
    max_lexical = max(lexical_best, default=0.0)

    ranked: list[HybridRankedChunk] = []
    for chunk_index in range(chunk_count):
        lexical_norm = (
            lexical_best[chunk_index] / max_lexical
            if max_lexical > 0
            else 0.0
        )
        dense_norm = max(0.0, min(1.0, dense_best[chunk_index]))

        hybrid_score = (
            rrf_scores[chunk_index]
            + 0.0020 * dense_norm
            + 0.0020 * lexical_norm
        )

        ranked.append(
            HybridRankedChunk(
                chunk_index=chunk_index,
                hybrid_score=hybrid_score,
                rrf_score=rrf_scores[chunk_index],
                dense_rank=dense_ranks[chunk_index],
                bm25_rank=lexical_ranks[chunk_index],
                dense_score=dense_best[chunk_index],
                bm25_score=lexical_best[chunk_index],
            )
        )

    ranked.sort(
        key=lambda item: (
            item.hybrid_score,
            -item.dense_rank,
            -item.bm25_rank,
            -item.chunk_index,
        ),
        reverse=True,
    )

    return ranked[: max(1, min(int(top_k), chunk_count))]
