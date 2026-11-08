from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Mapping, Sequence


@dataclass(frozen=True)
class CandidateGateResult:
    source_indexes: tuple[int, ...]
    broad_mode: bool
    per_facet_added: int
    evidence_added: int
    total: int


_HARD_LABELS = {
    "NUMERIC_CONSTRAINT",
    "DEADLINE",
    "THRESHOLD",
    "SECURITY_CONTROL",
    "PROHIBITION",
    "REQUIREMENT",
    "EXCEPTION",
}


def _safe(item: Mapping) -> bool:
    return not bool(item.get("negative_terms"))


def _hard_signal(item: Mapping) -> bool:
    labels = set(item.get("evidence_labels") or [])
    sentence = str(item.get("sentence") or "").lower()
    spelled_deadline = bool(
        re.search(
            r"\bwithin\s+(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+"
            r"(?:business\s+)?(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b",
            sentence,
        )
    )
    return (
        int(item.get("constraint_count") or 0) > 0
        or bool(item.get("has_constraint"))
        or bool(item.get("has_number"))
        or float(item.get("evidence_strength") or 0.0) >= 0.18
        or bool(labels & _HARD_LABELS)
        or spelled_deadline
    )


def build_broad_candidate_gate(
    *,
    scored: Sequence[Mapping],
    facets: Sequence[str],
    legacy_candidates: Sequence[Mapping],
    token_budget: int,
    per_facet_k: int = 12,
    min_facet_score: float = 0.30,
    evidence_floor: float = 0.24,
    max_candidates: int = 96,
) -> CandidateGateResult:
    """
    Precision-safe recall gate for large, broad extraction contracts.

    Narrow/normal requests keep the legacy candidate filter unchanged.

    Broad extraction requests use:
      1) legacy candidates;
      2) top-K safe candidates per requested facet;
      3) enforceable/numeric evidence with plausible facet support.

    Nothing is selected here. This only lets the existing cross-encoder,
    coverage optimizer, MMR, exclusions, and token budget evaluate the evidence.
    """
    broad_mode = (
        len(facets) >= 4
        and int(token_budget) >= 500
        and len(scored) >= 60
    )

    if not broad_mode:
        indexes = tuple(
            int(item["source_index"])
            for item in legacy_candidates
        )
        return CandidateGateResult(
            source_indexes=indexes,
            broad_mode=False,
            per_facet_added=0,
            evidence_added=0,
            total=len(indexes),
        )

    chosen: dict[int, Mapping] = {
        int(item["source_index"]): item
        for item in legacy_candidates
        if _safe(item)
    }

    per_facet_added = 0

    for facet in facets:
        ranked = sorted(
            (
                item
                for item in scored
                if _safe(item)
            ),
            key=lambda item: (
                float(item.get("facet_scores", {}).get(facet, 0.0)),
                1 if _hard_signal(item) else 0,
                float(item.get("priority_score") or 0.0),
                float(item.get("evidence_strength") or 0.0),
            ),
            reverse=True,
        )

        kept = 0
        for item in ranked:
            facet_score = float(item.get("facet_scores", {}).get(facet, 0.0))
            if facet_score < min_facet_score:
                break

            source_index = int(item["source_index"])
            if source_index not in chosen:
                chosen[source_index] = item
                per_facet_added += 1

            kept += 1
            if kept >= per_facet_k:
                break

    evidence_added = 0

    for item in scored:
        if not _safe(item) or not _hard_signal(item):
            continue

        best_facet_score = float(item.get("best_facet_score") or 0.0)
        if best_facet_score < evidence_floor:
            continue

        source_index = int(item["source_index"])
        if source_index not in chosen:
            chosen[source_index] = item
            evidence_added += 1

    # Bound the pool, but preserve legacy candidates first and rank added items
    # by broad-task usefulness.
    if len(chosen) > max_candidates:
        legacy_ids = {
            int(item["source_index"])
            for item in legacy_candidates
            if _safe(item)
        }

        protected = [
            chosen[index]
            for index in legacy_ids
            if index in chosen
        ]

        remainder = [
            item
            for index, item in chosen.items()
            if index not in legacy_ids
        ]

        remainder.sort(
            key=lambda item: (
                1 if _hard_signal(item) else 0,
                int(item.get("constraint_count") or 0),
                float(item.get("best_facet_score") or 0.0),
                float(item.get("evidence_strength") or 0.0),
                float(item.get("priority_score") or 0.0),
            ),
            reverse=True,
        )

        room = max(0, max_candidates - len(protected))
        final_items = protected + remainder[:room]
    else:
        final_items = list(chosen.values())

    final_items.sort(key=lambda item: int(item["source_index"]))

    return CandidateGateResult(
        source_indexes=tuple(int(item["source_index"]) for item in final_items),
        broad_mode=True,
        per_facet_added=per_facet_added,
        evidence_added=evidence_added,
        total=len(final_items),
    )
