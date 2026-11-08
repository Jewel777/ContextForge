from __future__ import annotations

import re

from dataclasses import dataclass
from math import exp
from typing import Iterable, Sequence

try:
    from sentence_transformers import CrossEncoder
except Exception:  # pragma: no cover
    CrossEncoder = None

from .reranker import reranker_service


DEFAULT_NLI_MODEL = "cross-encoder/nli-MiniLM2-L6-H768"

LOCAL_ROLE_HYPOTHESES = {
    "REQUIRED": (
        "This statement expresses an obligation, requirement, "
        "or required condition."
    ),
    "PROHIBITED": (
        "This statement forbids, prohibits, or disallows an action."
    ),
    "SUPPORTING": (
        "This statement provides technical or operational information "
        "without imposing an obligation."
    ),
    "BACKGROUND": (
        "This statement is descriptive background, routine context, "
        "or incidental information."
    ),
}


@dataclass(frozen=True)
class SemanticRole:
    role: str
    confidence: float
    relevance: float
    local_role: str
    local_scores: dict[str, float]


class SemanticEvidenceRoleClassifier:
    """
    Two-axis semantic classifier.

    Axis 1:
        Candidate-only NLI decides WHAT the sentence is:
        requirement / prohibition / supporting / background.

    Axis 2:
        The existing MS-MARCO cross-encoder decides WHETHER the
        sentence is relevant to the user's task.

    A narrow deterministic technical-signal check protects short,
    high-value technical facts whose meaning may not be captured
    reliably by the cross-encoder in isolation.
    """

    def __init__(
        self,
        model_name: str = DEFAULT_NLI_MODEL,
    ) -> None:
        self.model_name = model_name
        self._model = None
        self._load_error: str | None = None
        self._entailment_index = 1

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def _ensure_model(self):
        if self._model is not None:
            return self._model

        if self._load_error is not None:
            return None

        if CrossEncoder is None:
            self._load_error = (
                "sentence_transformers.CrossEncoder unavailable"
            )
            return None

        try:
            self._model = CrossEncoder(
                self.model_name
            )

            config = getattr(
                getattr(
                    self._model,
                    "model",
                    None,
                ),
                "config",
                None,
            )

            label2id = getattr(
                config,
                "label2id",
                {},
            ) or {}

            for key, value in label2id.items():
                if str(key).lower() == "entailment":
                    self._entailment_index = int(value)
                    break

        except Exception as exc:  # pragma: no cover
            self._load_error = (
                f"{type(exc).__name__}: {exc}"
            )
            self._model = None

        return self._model

    @staticmethod
    def _softmax(
        values: Sequence[float],
    ) -> list[float]:
        values = [
            float(value)
            for value in values
        ]

        peak = max(values)

        exps = [
            exp(value - peak)
            for value in values
        ]

        total = sum(exps) or 1.0

        return [
            value / total
            for value in exps
        ]

    @staticmethod
    def _minmax(
        values: Sequence[float],
    ) -> list[float]:
        if not values:
            return []

        low = min(values)
        high = max(values)
        span = high - low

        if span <= 1e-9:
            return [0.5] * len(values)

        return [
            (float(value) - low) / span
            for value in values
        ]

    @staticmethod
    def _technical_relevance_floor(
        task: str,
        evidence: str,
    ) -> float | None:
        """
        Return a conservative relevance floor when a short technical
        fact contains a concrete signal that directly corresponds to
        an explicitly requested objective.

        This must never create generic numeric relevance.
        """

        task_lower = task.lower()
        evidence_lower = evidence.lower()

        # ---------------------------------
        # Payload / storage / size limits
        # ---------------------------------
        size_requested = bool(
            re.search(
                r"\b(?:"
                r"payload|size|file size|message size|"
                r"body size|request size|response size"
                r")\b",
                task_lower,
            )
        )

        size_signal = bool(
            re.search(
                r"\b\d+(?:\.\d+)?\s*"
                r"(?:kb|mb|gb|tb|kib|mib|gib|tib|bytes?)\b",
                evidence_lower,
            )
        )

        if size_requested and size_signal:
            return 0.72

        # -------------------------
        # Rate / throughput limits
        # -------------------------
        rate_requested = bool(
            re.search(
                r"\b(?:"
                r"rate|rates|rate limit|rate limits|"
                r"throughput|requests per second|"
                r"requests per minute|rps|qps|rpm"
                r")\b",
                task_lower,
            )
        )

        rate_signal = bool(
            re.search(
                r"\b\d+(?:\.\d+)?\s*"
                r"(?:rps|qps|rpm)\b",
                evidence_lower,
            )
            or re.search(
                r"\b\d+(?:\.\d+)?\s+requests?\b",
                evidence_lower,
            )
        )

        if rate_requested and rate_signal:
            return 0.72

        # -------------------------
        # Explicit dates/deadlines
        # -------------------------
        date_requested = bool(
            re.search(
                r"\b(?:"
                r"dates?|deadlines?|deprecation|deprecated|"
                r"sunset|retirement"
                r")\b",
                task_lower,
            )
        )

        month_date_signal = bool(
            re.search(
                r"\b(?:"
                r"jan(?:uary)?|"
                r"feb(?:ruary)?|"
                r"mar(?:ch)?|"
                r"apr(?:il)?|"
                r"may|"
                r"jun(?:e)?|"
                r"jul(?:y)?|"
                r"aug(?:ust)?|"
                r"sep(?:tember)?|"
                r"oct(?:ober)?|"
                r"nov(?:ember)?|"
                r"dec(?:ember)?"
                r")\s+\d{1,2}(?:,\s*|\s+)\d{4}\b",
                evidence_lower,
            )
        )

        iso_date_signal = bool(
            re.search(
                r"\b\d{4}-\d{1,2}-\d{1,2}\b",
                evidence_lower,
            )
        )

        if (
            date_requested
            and (
                month_date_signal
                or iso_date_signal
            )
        ):
            return 0.72

        # -------------------------
        # Explicit endpoint / path
        # -------------------------
        endpoint_requested = bool(
            re.search(
                r"\b(?:"
                r"endpoint|api endpoint|route|path|url"
                r")\b",
                task_lower,
            )
        )

        endpoint_signal = bool(
            re.search(
                r"(?:^|\s)/[A-Za-z0-9_.~!$&'()*+,;=:@%/-]+",
                evidence,
            )
        )

        if endpoint_requested and endpoint_signal:
            return 0.72

        # -------------------------
        # Authentication headers
        # -------------------------
        auth_header_requested = bool(
            re.search(
                r"\b(?:header|bearer|jwt|authorization)\b",
                task_lower,
            )
        )

        auth_header_signal = bool(
            re.search(
                r"\b(?:bearer|jwt|authorization)\b",
                evidence_lower,
            )
            or re.search(
                r"\b[A-Za-z][A-Za-z0-9-]*-Auth\b",
                evidence,
                re.I,
            )
        )

        token_lifetime_requested = bool(
            re.search(
                r"\b(?:security|tokens?|token\s+lifetime|"
                r"expiration|expiry)\b",
                task_lower,
            )
            or (
                re.search(
                    r"\b(?:authentication|auth)\b",
                    task_lower,
                )
                and not re.search(
                    r"\bauthentication\s+header\b",
                    task_lower,
                )
            )
        )

        token_lifetime_signal = bool(
            re.search(
                r"\b(?:access|refresh)\s+tokens?\b",
                evidence_lower,
            )
        )

        if (
            auth_header_requested
            and auth_header_signal
        ):
            return 0.72

        if (
            token_lifetime_requested
            and token_lifetime_signal
        ):
            return 0.72

        dr_requested = bool(
            re.search(
                r"\b(?:disaster[\s-]*recovery|"
                r"recovery\s+time\s+objective|"
                r"recovery\s+point\s+objective|"
                r"rto|rpo|failover)\b",
                task_lower,
            )
        )

        dr_signal = bool(
            re.search(
                r"\b(?:disaster[\s-]*recovery|"
                r"recovery\s+time\s+objective|"
                r"recovery\s+point\s+objective|"
                r"rto|rpo|failover)\b",
                evidence_lower,
            )
        )

        if dr_requested and dr_signal:
            return 0.72

        database_requested = bool(
            re.search(r"\b(?:database|connection|slow[-\s]?query|backup|retention)\b", task_lower)
        )
        database_signal = bool(
            re.search(
                r"\b(?:database|connections?|slow\s+queries?|backups?|restore)\b",
                evidence_lower,
            )
        )

        deployment_requested = bool(
            re.search(
                r"\b(?:deployment|production\s+api|upload|cache|schema|port|retry)\b",
                task_lower,
            )
        )
        deployment_signal = bool(
            re.search(
                r"\b(?:production\s+api|port\s+\d+|requests?\s+larger|"
                r"sqlite\s+cache|cache\s+schema|retry\s+attempts?|"
                r"emergency\s+changes|retrospective\s+review)\b",
                evidence_lower,
            )
        )

        incident_requested = bool(
            re.search(r"\b(?:incident\s+response|severity|error\s+rate|latency|alert)\b", task_lower)
        )
        incident_signal = bool(
            re.search(
                r"\b(?:severity\s+\d+|error\s+rate|latency\s+alert|"
                r"response\s+time|incident\s+commander)\b",
                evidence_lower,
            )
        )

        security_requested = bool(
            re.search(r"\b(?:security|vendor)\b", task_lower)
        )
        security_signal = bool(
            re.search(r"\b(?:critical\s+vendors?|reassessed)\b", evidence_lower)
        )

        research_requested = bool(
            re.search(
                r"\b(?:detector|settings?|threshold|attack\s+result|"
                r"poisoning|similarity)\b",
                task_lower,
            )
        )
        research_signal = bool(
            re.search(
                r"\b(?:detector|median\s+absolute\s+deviation|"
                r"window\s+of\s+(?:one|two|three|four|five|six|seven|eight|nine|ten)|"
                r"threshold\s+multiplier|alert[-\s]?set\s+changes?|jaccard)\b",
                evidence_lower,
            )
        )

        if (
            (database_requested and database_signal)
            or (deployment_requested and deployment_signal)
            or (incident_requested and incident_signal)
            or (security_requested and security_signal)
            or (research_requested and research_signal)
        ):
            return 0.72

        return None

    def classify_many(
        self,
        *,
        task: str,
        evidence_texts: Iterable[str],
    ) -> list[SemanticRole | None]:
        texts = [
            str(text).strip()
            for text in evidence_texts
        ]

        if not texts:
            return []

        model = self._ensure_model()

        if model is None:
            return [None] * len(texts)

        # -----------------------------
        # Axis 1: local evidence role
        # -----------------------------
        role_names = list(
            LOCAL_ROLE_HYPOTHESES
        )

        pairs: list[
            tuple[str, str]
        ] = []

        for text in texts:
            for role in role_names:
                pairs.append(
                    (
                        text,
                        LOCAL_ROLE_HYPOTHESES[
                            role
                        ],
                    )
                )

        raw = model.predict(
            pairs,
            show_progress_bar=False,
            convert_to_numpy=True,
        )

        local_results: list[
            tuple[
                str,
                float,
                dict[str, float],
            ]
        ] = []

        width = len(role_names)

        for offset in range(
            0,
            len(raw),
            width,
        ):
            block = raw[
                offset : offset + width
            ]

            entailment: dict[
                str,
                float,
            ] = {}

            for role, row in zip(
                role_names,
                block,
            ):
                probs = self._softmax(
                    row
                )

                entailment[role] = float(
                    probs[
                        min(
                            self._entailment_index,
                            len(probs) - 1,
                        )
                    ]
                )

            total = (
                sum(
                    entailment.values()
                )
                or 1.0
            )

            normalized = {
                role: score / total
                for role, score
                in entailment.items()
            }

            best = max(
                normalized,
                key=normalized.get,
            )

            local_results.append(
                (
                    best,
                    float(
                        normalized[best]
                    ),
                    normalized,
                )
            )

        # -----------------------------
        # Axis 2: task relevance
        # -----------------------------
        reranked = (
            reranker_service.rerank(
                query=task,
                candidates=texts,
                fallback_scores=[
                    0.0
                ] * len(texts),
                top_k=len(texts),
            )
        )

        raw_relevance = [
            0.0
        ] * len(texts)

        for result in reranked:
            raw_relevance[
                result.index
            ] = float(
                result.score
            )

        # Convert the reranker's absolute raw score into
        # an independent 0..1 relevance value.
        relevance = [
            1.0
            / (
                1.0
                + exp(
                    -(
                        score
                        + 5.0
                    )
                )
            )
            for score in raw_relevance
        ]

        # Apply only narrow deterministic technical floors.
        # These do not make arbitrary numeric sentences relevant.
        for index, text in enumerate(
            texts
        ):
            floor = (
                self._technical_relevance_floor(
                    task,
                    text,
                )
            )

            if floor is not None:
                relevance[index] = max(
                    relevance[index],
                    floor,
                )

        # -----------------------------
        # Fuse axes
        # -----------------------------
        results: list[
            SemanticRole
        ] = []

        for index, (
            local_role,
            local_confidence,
            scores,
        ) in enumerate(
            local_results
        ):
            if (
                local_role == "PROHIBITED"
                and re.search(
                    r"\b(?:deprecation|sunset|retirement|effective|release)\s+date\s+(?:is|will be|:)\s*",
                    texts[index].lower(),
                )
            ):
                local_role = "SUPPORTING"

            rel = float(
                relevance[index]
            )

            if rel <= 0.18:
                final_role = (
                    "IRRELEVANT"
                )

                confidence = max(
                    local_confidence,
                    1.0 - rel,
                )

            elif local_role in {
                "REQUIRED",
                "PROHIBITED",
            }:
                final_role = (
                    local_role
                )

                confidence = (
                    0.65
                    * local_confidence
                    + 0.35
                    * rel
                )

            elif (
                local_role
                == "BACKGROUND"
                and rel < 0.45
            ):
                final_role = (
                    "IRRELEVANT"
                )

                confidence = (
                    0.60
                    * local_confidence
                    + 0.40
                    * (
                        1.0 - rel
                    )
                )

            else:
                final_role = (
                    local_role
                )

                confidence = (
                    0.65
                    * local_confidence
                    + 0.35
                    * rel
                )

            results.append(
                SemanticRole(
                    role=final_role,
                    confidence=float(
                        confidence
                    ),
                    relevance=rel,
                    local_role=local_role,
                    local_scores=scores,
                )
            )

        return results


semantic_role_classifier = (
    SemanticEvidenceRoleClassifier()
)