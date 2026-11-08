from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping, Sequence

from .constraint_extractor import extract_constraints
from .evidence_classifier import classify_evidence


_CLAUSE_BOUNDARY_RE = re.compile(
    r"\s*;\s*|\s+(?=but\s+|however\s+)",
    re.IGNORECASE,
)

# Split "A ... and B ..." only when the right-hand side starts a new predicate.
# This avoids breaking lists such as "manager approval and MFA".
_AND_PREDICATE_RE = re.compile(
    r"\s+and\s+(?="
    r"(?:the\s+)?(?:[A-Z][A-Za-z0-9_-]*\s+){0,4}"
    r"(?:is|are|must|shall|requires?|expire(?:s)?|retry|retries|run|runs|"
    r"remain|remains|exceed|exceeds|trigger|triggers|notify|notifies|"
    r"lock|locks|retain|retains|conduct|conducts|complete|completes)\b"
    r")",
    re.IGNORECASE,
)

_NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?\b")

_UNIT_RE = re.compile(
    r"\b(?:ms|milliseconds?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|"
    r"%|kb|mb|gb|tb|connections?|attempts?|times?)\b",
    re.IGNORECASE,
)

_MANDATORY_RE = re.compile(
    r"\b(?:must|shall|required|requires?|cannot|may not|prohibited|mandatory)\b",
    re.IGNORECASE,
)

_FACET_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")

_FACET_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


def _facet_tokens(text: str) -> tuple[str, ...]:
    return tuple(
        token.lower()
        for token in _FACET_TOKEN_RE.findall(str(text))
        if token.lower() not in _FACET_STOPWORDS
    )


def _related_token(left: str, right: str) -> bool:
    if left == right:
        return True

    # Lightweight morphology matching:
    # deprecation <-> deprecated
    # authentication <-> authenticate
    # limitation <-> limit
    if len(left) >= 5 and len(right) >= 5:
        return left[:5] == right[:5]

    return False


def _rescore_clause_facets(
    clause: str,
    facets: Sequence[str],
    source_scores: Mapping[str, float],
) -> dict[str, float]:
    """
    Refine sentence-level facet relevance at clause granularity.

    Sentence-level semantic scores remain useful as a prior, but clause-local
    lexical agreement is allowed to override an unrelated dominant parent
    facet when one source sentence contains multiple independent facts.
    """
    clause_tokens = _facet_tokens(clause)
    rescored: dict[str, float] = {}

    for facet in facets:
        facet_name = str(facet)
        parent_score = float(source_scores.get(facet_name, 0.0))
        facet_tokens = _facet_tokens(facet_name)

        if not clause_tokens or not facet_tokens:
            rescored[facet_name] = parent_score
            continue

        matched = sum(
            1
            for facet_token in facet_tokens
            if any(
                _related_token(facet_token, clause_token)
                for clause_token in clause_tokens
            )
        )

        lexical_score = matched / len(facet_tokens)

        refined = (
            parent_score * 0.55
            + lexical_score * 0.65
        )

        rescored[facet_name] = min(1.0, refined)

    return rescored


@dataclass(frozen=True)
class FactAtom:
    atom_id: str
    source_index: int
    page: int | None
    section: str | None
    text: str
    source_sentence: str
    facet: str | None
    facet_score: float
    facet_scores: tuple[tuple[str, float], ...]
    matched_facets: tuple[str, ...]
    evidence_type: str
    evidence_labels: tuple[str, ...]
    evidence_strength: float
    structured_constraints: tuple[dict, ...]
    has_number: bool
    has_unit: bool
    mandatory: bool
    semantic_score: float
    priority_score: float
    reranker_score: float | None
    negative_terms: tuple[str, ...]

    @property
    def hard(self) -> bool:
        """
        Intrinsic hard evidence only.

        A schedule/frequency extractor firing is NOT enough by itself to make
        background text hard evidence. This prevents routine meetings or
        dashboard review cadence from competing with true policy constraints.

        Preserve as hard when the atom is:
        - an explicit requirement/prohibition/control;
        - typed as non-background evidence; or
        - a structured numeric constraint.

        Bare recurring-frequency/background text without an explicit number
        remains soft and can be rejected by task relevance.
        """
        typed_evidence = self.evidence_type not in {
            "BACKGROUND",
            "UNKNOWN",
        }

        numeric_constraint = (
            bool(self.structured_constraints)
            and self.has_number
        )

        return bool(
            self.mandatory
            or typed_evidence
            or numeric_constraint
        )

    def to_item(self) -> dict:
        facet_scores = dict(self.facet_scores)

        return {
            "atom_id": self.atom_id,
            "source_index": self.source_index,
            "page": self.page,
            "section": self.section,
            "sentence": self.text,
            "source_sentence": self.source_sentence,
            "best_facet": self.facet,
            "best_facet_score": self.facet_score,
            "facet_scores": facet_scores,
            "matched_facets": list(self.matched_facets),
            "semantic_score": self.semantic_score,
            "priority_score": self.priority_score,
            "reranker_score": self.reranker_score,
            "evidence_type": self.evidence_type,
            "evidence_labels": list(self.evidence_labels),
            "evidence_strength": self.evidence_strength,
            "structured_constraints": list(
                self.structured_constraints
            ),
            "constraint_count": len(
                self.structured_constraints
            ),
            "has_constraint": bool(
                self.structured_constraints
            ),
            "has_number": self.has_number,
            "has_unit": self.has_unit,
            "mandatory": self.mandatory,
            "negative_terms": set(self.negative_terms),
            "preserve_terms": set(),
        }


def split_fact_clauses(sentence: str) -> list[str]:
    """
    Conservative clause decomposition.

    We split semicolon/but boundaries and coordinated independent predicates.
    We deliberately do not split simple noun/object lists.
    """
    sentence = " ".join(
        str(sentence).split()
    ).strip()

    if not sentence:
        return []

    pieces: list[str] = []

    for part in _CLAUSE_BOUNDARY_RE.split(sentence):
        part = part.strip(" ,")

        if not part:
            continue

        subparts = _AND_PREDICATE_RE.split(part)

        for subpart in subparts:
            cleaned = subpart.strip(" ,")

            if cleaned:
                pieces.append(cleaned)

    return pieces or [sentence]


def _best_facet(
    item: Mapping,
    facets: Sequence[str],
) -> tuple[str | None, float]:
    scores = item.get("facet_scores") or {}

    if not facets:
        return (
            item.get("best_facet"),
            float(
                item.get("best_facet_score")
                or 0.0
            ),
        )

    facet = max(
        facets,
        key=lambda name: float(
            scores.get(name, 0.0)
        ),
    )

    return (
        str(facet),
        float(scores.get(facet, 0.0)),
    )


def _matched_facets(
    item: Mapping,
    facets: Sequence[str],
) -> tuple[str, ...]:
    scores = item.get("facet_scores") or {}

    if not facets or not scores:
        best = item.get("best_facet")
        return (str(best),) if best else ()

    best_score = max(
        (
            float(scores.get(name, 0.0))
            for name in facets
        ),
        default=0.0,
    )

    matched = [
        str(name)
        for name in facets
        if float(scores.get(name, 0.0)) >= 0.58
        and float(scores.get(name, 0.0))
        >= best_score * 0.82
    ]

    return tuple(matched)


def _matched_facets_from_scores(
    scores: Mapping[str, float],
    facets: Sequence[str],
) -> tuple[str, ...]:
    if not facets or not scores:
        return ()

    best_score = max(
        (
            float(scores.get(str(name), 0.0))
            for name in facets
        ),
        default=0.0,
    )

    return tuple(
        str(name)
        for name in facets
        if float(
            scores.get(str(name), 0.0)
        ) >= 0.58
        and float(
            scores.get(str(name), 0.0)
        ) >= best_score * 0.82
    )


def atomize_scored_items(
    *,
    scored: Sequence[Mapping],
    facets: Sequence[str],
) -> list[FactAtom]:
    """
    Convert scored sentences into provenance-preserving fact atoms.

    Single-clause evidence preserves the original sentence-level retrieval
    scores exactly.

    Multi-clause sentences receive lightweight clause-level facet refinement
    so independent facts do not blindly inherit another clause's dominant
    facet.

    Evidence typing and structured constraints are recomputed independently
    for every clause.
    """
    atoms: list[FactAtom] = []

    for item in scored:
        if item.get("negative_terms"):
            continue

        sentence = str(
            item.get("sentence") or ""
        ).strip()

        if not sentence:
            continue

        source_facet_scores = {
            str(name): float(score)
            for name, score in (
                item.get("facet_scores") or {}
            ).items()
        }

        clauses = split_fact_clauses(sentence)

        for clause_index, clause in enumerate(
            clauses
        ):
            if len(clauses) > 1:
                clause_facet_scores = (
                    _rescore_clause_facets(
                        clause,
                        facets,
                        source_facet_scores,
                    )
                )
            else:
                # Preserve legacy behavior for ordinary single-clause
                # evidence. Clause-level rescoring is only necessary
                # when one source sentence contains multiple facts.
                clause_facet_scores = dict(
                    source_facet_scores
                )

            if facets:
                facet = max(
                    facets,
                    key=lambda name: float(
                        clause_facet_scores.get(
                            str(name),
                            0.0,
                        )
                    ),
                )

                facet = str(facet)

                facet_score = float(
                    clause_facet_scores.get(
                        facet,
                        0.0,
                    )
                )

                if len(clauses) > 1:
                    matched_facets = (
                        _matched_facets_from_scores(
                            clause_facet_scores,
                            facets,
                        )
                    )
                else:
                    # Preserve the original matched-facet behavior
                    # for single-clause evidence as well.
                    matched_facets = _matched_facets(
                        item,
                        facets,
                    )
            else:
                facet, facet_score = _best_facet(
                    item,
                    facets,
                )

                clause_facet_scores = (
                    source_facet_scores
                )

                matched_facets = _matched_facets(
                    item,
                    facets,
                )

            evidence = classify_evidence(clause)
            constraints = extract_constraints(
                clause
            )

            labels = tuple(
                sorted(
                    label.value
                    for label in evidence.labels
                )
            )

            evidence_type = (
                evidence.primary.value
            )

            atoms.append(
                FactAtom(
                    atom_id=(
                        f'{int(item["source_index"])}'
                        f":{clause_index}"
                    ),
                    source_index=int(
                        item["source_index"]
                    ),
                    page=(
                        item.get("page")
                        if isinstance(
                            item.get("page"),
                            int,
                        )
                        else None
                    ),
                    section=item.get("section"),
                    text=clause,
                    source_sentence=sentence,
                    facet=facet,
                    facet_score=facet_score,
                    facet_scores=tuple(
                        sorted(
                            clause_facet_scores.items()
                        )
                    ),
                    matched_facets=matched_facets,
                    evidence_type=evidence_type,
                    evidence_labels=labels,
                    evidence_strength=float(
                        evidence.strength
                    ),
                    structured_constraints=tuple(
                        fact.to_dict()
                        for fact in constraints
                    ),
                    has_number=bool(
                        _NUMBER_RE.search(clause)
                    ),
                    has_unit=bool(
                        _UNIT_RE.search(clause)
                    ),
                    mandatory=bool(
                        _MANDATORY_RE.search(clause)
                    ),
                    semantic_score=float(
                        item.get(
                            "semantic_score"
                        )
                        or 0.0
                    ),
                    priority_score=float(
                        item.get(
                            "priority_score"
                        )
                        or 0.0
                    ),
                    reranker_score=(
                        float(
                            item[
                                "reranker_score"
                            ]
                        )
                        if item.get(
                            "reranker_score"
                        )
                        is not None
                        else None
                    ),
                    negative_terms=tuple(
                        sorted(
                            item.get(
                                "negative_terms"
                            )
                            or set()
                        )
                    ),
                )
            )

    return atoms