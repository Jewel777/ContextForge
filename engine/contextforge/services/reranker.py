from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

try:
    from sentence_transformers import CrossEncoder
except Exception:  # pragma: no cover - runtime fallback path
    CrossEncoder = None


DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


@dataclass(frozen=True)
class RerankedItem:
    index: int
    score: float


class CrossEncoderReranker:
    """
    Optional neural reranker for ContextForge.

    Design goals:
    - lazy model loading
    - deterministic fallback when model/dependency is unavailable
    - no API changes required in the rest of the engine
    - bounded top-k reranking to keep latency practical
    """

    def __init__(self, model_name: str = DEFAULT_MODEL) -> None:
        self.model_name = model_name
        self._model = None
        self._load_error: str | None = None

    @property
    def available(self) -> bool:
        return self._load_error is None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def _ensure_model(self):
        if self._model is not None:
            return self._model

        if self._load_error is not None:
            return None

        if CrossEncoder is None:
            self._load_error = "sentence_transformers.CrossEncoder unavailable"
            return None

        try:
            self._model = CrossEncoder(self.model_name)
        except Exception as exc:  # pragma: no cover - environment dependent
            self._load_error = f"{type(exc).__name__}: {exc}"
            self._model = None

        return self._model

    def rerank(
        self,
        *,
        query: str,
        candidates: Sequence[str],
        fallback_scores: Sequence[float] | None = None,
        top_k: int | None = None,
    ) -> list[RerankedItem]:
        if not candidates:
            return []

        if fallback_scores is not None and len(fallback_scores) != len(candidates):
            raise ValueError("fallback_scores must match candidate count")

        model = self._ensure_model()

        if model is None:
            scores = (
                list(fallback_scores)
                if fallback_scores is not None
                else [0.0] * len(candidates)
            )
        else:
            pairs = [(query, candidate) for candidate in candidates]
            raw = model.predict(
                pairs,
                show_progress_bar=False,
                convert_to_numpy=True,
            )
            scores = [float(value) for value in raw]

        ranked = [
            RerankedItem(index=index, score=float(score))
            for index, score in enumerate(scores)
        ]
        ranked.sort(
            key=lambda item: (item.score, -item.index),
            reverse=True,
        )

        if top_k is not None:
            ranked = ranked[: max(1, min(int(top_k), len(ranked)))]

        return ranked


reranker_service = CrossEncoderReranker()
