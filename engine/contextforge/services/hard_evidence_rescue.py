from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence


@dataclass(frozen=True)
class RescuePick:
    source_index: int
    facet: str
    score: float


def _hard(item: Mapping) -> bool:
    return (
        bool(item.get("has_constraint"))
        or int(item.get("constraint_count") or 0) > 0
        or float(item.get("evidence_strength") or 0.0) >= 0.18
        or bool(item.get("has_number"))
    )


def _supports(item: Mapping, facet: str, threshold: float) -> bool:
    if item.get("negative_terms"):
        return False
    return float(item.get("facet_scores", {}).get(facet, 0.0)) >= threshold


def plan_targeted_hard_rescue(
    *,
    scored: Sequence[Mapping],
    selected: Sequence[Mapping],
    facets: Sequence[str],
    min_hard_per_facet: int = 3,
    min_facet_score: float = 0.42,
    max_additions: int = 18,
) -> list[RescuePick]:
    """
    Targeted second-pass rescue for broad extraction tasks.

    Unlike the rejected recall-guard experiment, this does NOT globally widen
    the candidate pool. It only searches for hard evidence in facets that are
    under-covered after the normal retrieval/packing pass.

    This preserves narrow-task behavior and avoids admitting unrelated prose.
    """
    selected_ids = {int(item["source_index"]) for item in selected}
    picks: list[RescuePick] = []

    hard_counts: dict[str, int] = {}
    for facet in facets:
        hard_counts[facet] = sum(
            1
            for item in selected
            if _supports(item, facet, min_facet_score) and _hard(item)
        )

    for facet in facets:
        needed = max(0, min_hard_per_facet - hard_counts[facet])
        if needed <= 0:
            continue

        ranked = sorted(
            (
                item
                for item in scored
                if int(item["source_index"]) not in selected_ids
                and _supports(item, facet, min_facet_score)
                and _hard(item)
            ),
            key=lambda item: (
                int(item.get("constraint_count") or 0),
                float(item.get("evidence_strength") or 0.0),
                float(item.get("reranker_score") or 0.0),
                float(item.get("priority_score") or 0.0),
                float(item.get("facet_scores", {}).get(facet, 0.0)),
            ),
            reverse=True,
        )

        for item in ranked:
            if len(picks) >= max_additions or needed <= 0:
                break

            source_index = int(item["source_index"])
            if source_index in selected_ids:
                continue

            score = (
                float(item.get("facet_scores", {}).get(facet, 0.0)) * 0.45
                + float(item.get("priority_score") or 0.0) * 0.25
                + float(item.get("evidence_strength") or 0.0) * 0.15
                + min(0.15, int(item.get("constraint_count") or 0) * 0.05)
            )

            picks.append(
                RescuePick(
                    source_index=source_index,
                    facet=facet,
                    score=score,
                )
            )
            selected_ids.add(source_index)
            needed -= 1

    return picks
