from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Mapping, Sequence


@dataclass(frozen=True)
class FacetCoverageStatus:
    facet: str
    semantic_evidence_count: int
    hard_evidence_count: int
    numeric_evidence_count: int
    structured_constraint_count: int
    covered_semantically: bool
    covered_by_hard_evidence: bool

    def to_dict(self) -> dict:
        return asdict(self)


def _supports_facet(item: Mapping, facet: str, threshold: float = 0.50) -> bool:
    if item.get("negative_terms"):
        return False

    score = float(item.get("facet_scores", {}).get(facet, 0.0))
    return score >= threshold


def _is_hard_evidence(item: Mapping) -> bool:
    return (
        bool(item.get("has_constraint"))
        or int(item.get("constraint_count") or 0) > 0
        or float(item.get("evidence_strength") or 0.0) >= 0.18
        or bool(item.get("has_number"))
    )


def validate_hard_evidence_coverage(
    *,
    selected: Sequence[Mapping],
    facets: Sequence[str],
    semantic_threshold: float = 0.50,
) -> dict:
    """
    Distinguish semantic coverage from actual hard-evidence coverage.

    A facet is semantically covered when at least one selected sentence is
    relevant to it.

    A facet is hard-covered only when at least one selected sentence both:
      - supports the facet; and
      - carries a constraint / number / typed evidence signal.

    This prevents ContextForge from claiming complete coverage merely because
    it selected a section title or broad descriptive sentence.
    """
    statuses: list[FacetCoverageStatus] = []

    for facet in facets:
        supporting = [
            item
            for item in selected
            if _supports_facet(item, facet, semantic_threshold)
        ]

        hard = [
            item
            for item in supporting
            if _is_hard_evidence(item)
        ]

        numeric = [
            item
            for item in supporting
            if bool(item.get("has_number"))
        ]

        structured_constraint_count = sum(
            int(item.get("constraint_count") or 0)
            for item in supporting
        )

        statuses.append(
            FacetCoverageStatus(
                facet=facet,
                semantic_evidence_count=len(supporting),
                hard_evidence_count=len(hard),
                numeric_evidence_count=len(numeric),
                structured_constraint_count=structured_constraint_count,
                covered_semantically=bool(supporting),
                covered_by_hard_evidence=bool(hard),
            )
        )

    semantic_covered = sum(
        1 for status in statuses if status.covered_semantically
    )
    hard_covered = sum(
        1 for status in statuses if status.covered_by_hard_evidence
    )

    return {
        "facets": [status.to_dict() for status in statuses],
        "semantic_coverage": {
            "covered": semantic_covered,
            "total": len(statuses),
        },
        "hard_evidence_coverage": {
            "covered": hard_covered,
            "total": len(statuses),
        },
        "missing_hard_evidence_facets": [
            status.facet
            for status in statuses
            if not status.covered_by_hard_evidence
        ],
    }
