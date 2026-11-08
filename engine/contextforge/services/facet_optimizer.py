from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence


@dataclass(frozen=True)
class CoveragePick:
    candidate_index: int
    facet: str
    score: float
    marginal_gain: float


def _item_value(item: Mapping, facet: str) -> float:
    """
    Score one candidate for one requested facet.

    The optimizer combines independent signals already produced upstream:
    semantic facet relevance, cross-encoder relevance, evidence strength,
    structured constraints, and the deterministic priority score.
    """
    facet_score = float(item.get("facet_scores", {}).get(facet, 0.0))
    reranker = float(item.get("reranker_score") or 0.0)
    evidence = float(item.get("evidence_strength") or 0.0)
    constraints = int(item.get("constraint_count") or 0)
    priority = float(item.get("priority_score") or 0.0)

    constraint_bonus = min(0.16, constraints * 0.055)

    return (
        facet_score * 0.48
        + reranker * 0.22
        + priority * 0.18
        + evidence * 0.08
        + constraint_bonus
    )


def plan_facet_coverage(
    *,
    candidates: Sequence[Mapping],
    facets: Sequence[str],
    token_costs: Sequence[int],
    token_budget: int,
    max_per_facet: int = 3,
    min_facet_score: float = 0.50,
) -> list[CoveragePick]:
    """
    Greedy submodular-style coverage planner.

    Objective:
        maximize domain coverage + relevance + hard-evidence preservation
        while respecting a strict token budget.

    The first pass strongly rewards uncovered facets. Later picks may add
    additional facts for an already-covered facet, but with diminishing
    returns. This prevents a single easy domain from consuming the context.
    """
    if len(candidates) != len(token_costs):
        raise ValueError("token_costs must match candidates")

    if token_budget <= 0 or not candidates or not facets:
        return []

    selected: set[int] = set()
    facet_counts = {facet: 0 for facet in facets}
    used_tokens = 0
    picks: list[CoveragePick] = []

    while True:
        best = None
        best_gain = 0.0

        for index, item in enumerate(candidates):
            if index in selected:
                continue

            cost = max(1, int(token_costs[index]))
            if used_tokens + cost > token_budget:
                continue

            if item.get("negative_terms"):
                continue

            for facet in facets:
                facet_score = float(item.get("facet_scores", {}).get(facet, 0.0))
                if facet_score < min_facet_score:
                    continue

                count = facet_counts[facet]
                if count >= max_per_facet:
                    continue

                base = _item_value(item, facet)

                # Coverage is the key objective. First evidence for a facet gets
                # a large bonus; additional evidence has diminishing returns.
                if count == 0:
                    coverage_bonus = 0.52
                elif count == 1:
                    coverage_bonus = 0.19
                else:
                    coverage_bonus = 0.07

                # Structured constraints are especially valuable as second/third
                # facts because they tend to contain exact limits/deadlines.
                constraint_bonus = min(
                    0.12,
                    int(item.get("constraint_count") or 0) * 0.04,
                )

                # Cost-aware utility avoids using a long descriptive sentence
                # when a concise hard fact provides comparable evidence.
                raw_gain = base + coverage_bonus + constraint_bonus
                efficiency = raw_gain / (1.0 + cost / 45.0)

                if efficiency > best_gain:
                    best_gain = efficiency
                    best = (index, facet, raw_gain, cost)

        if best is None:
            break

        index, facet, raw_gain, cost = best
        selected.add(index)
        facet_counts[facet] += 1
        used_tokens += cost

        picks.append(
            CoveragePick(
                candidate_index=index,
                facet=facet,
                score=_item_value(candidates[index], facet),
                marginal_gain=raw_gain,
            )
        )

        # Once every facet has evidence, permit another round only if there is
        # meaningful budget left. Global MMR will use the remaining budget.
        if all(facet_counts[facet] > 0 for facet in facets):
            if used_tokens >= token_budget * 0.82:
                break

    return picks
