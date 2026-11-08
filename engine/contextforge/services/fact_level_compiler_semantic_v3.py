from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence

from .fact_atomizer_v2 import FactAtom
from .critical_evidence_features_v2 import detect_critical_feature


@dataclass(frozen=True)
class FactCompileResult:
    selected_atom_ids: tuple[str, ...]
    atoms_considered: int
    hard_atoms_considered: int
    selected_atoms: int
    used_tokens: int
    facet_counts: dict[str, int]
    pages: tuple[int, ...]


def _value(atom: FactAtom) -> float:
    reranker = atom.reranker_score if atom.reranker_score is not None else 0.5
    critical = detect_critical_feature({"sentence": atom.text})

    evidence_bonus = {
        "DEADLINE": 0.18,
        "THRESHOLD": 0.18,
        "NUMERIC_CONSTRAINT": 0.17,
        "SECURITY_CONTROL": 0.16,
        "PROHIBITION": 0.15,
        "REQUIREMENT": 0.14,
        "EXCEPTION": 0.10,
        "BACKGROUND": 0.0,
        "UNKNOWN": 0.0,
    }.get(atom.evidence_type, 0.04)

    return (
        atom.facet_score * 0.30
        + atom.priority_score * 0.18
        + reranker * 0.10
        + atom.evidence_strength * 0.10
        + min(0.18, len(atom.structured_constraints) * 0.07)
        + (0.10 if atom.has_number else 0.0)
        + (0.06 if atom.has_unit else 0.0)
        + (0.10 if atom.mandatory else 0.0)
        + evidence_bonus
        + (0.22 if critical is not None else 0.0)
    )


def compile_fact_atoms(
    *,
    atoms: Sequence[FactAtom],
    facets: Sequence[str],
    token_costs: dict[str, int],
    token_budget: int,
    facet_floor: int = 4,
    semantic_roles: Mapping[str, object] | None = None,
) -> FactCompileResult:
    """
    Select independent fact atoms under a hard token budget.

    The compiler is coverage-first, evidence-first, and provenance-preserving.
    It never spends budget on a whole source sentence merely because one clause
    in that sentence is useful.
    """
    semantic_roles = semantic_roles or {}

    def is_semantically_irrelevant_soft(atom: FactAtom) -> bool:
        """
        Semantic model is a veto only for SOFT evidence.

        Hard evidence keeps Step16's exact ordering and selection behavior.
        """
        if atom.hard:
            return False

        prediction = semantic_roles.get(atom.atom_id)
        if prediction is None:
            return False

        role = getattr(prediction, "role", None)
        confidence = float(getattr(prediction, "confidence", 0.0))
        relevance = float(getattr(prediction, "relevance", 0.5))

        return (
            role == "IRRELEVANT"
            and confidence >= 0.80
            and relevance <= 0.20
        )

    def is_guarded_irrelevant(atom: FactAtom) -> bool:
        """
        High-confidence task-irrelevance veto with hard safety rails.

        Genuine requirements, structured constraints, and recognized critical
        evidence are protected before the semantic model is allowed to veto.

        This prevents important limits such as token lifetimes from being
        discarded while still allowing unrelated recurring background text
        such as dashboard refreshes to be rejected.
        """

        prediction = semantic_roles.get(atom.atom_id)

        if prediction is None:
            return False

        role = getattr(prediction, "role", None)
        confidence = float(
            getattr(prediction, "confidence", 0.0)
        )
        relevance = float(
            getattr(prediction, "relevance", 0.5)
        )

        strongly_irrelevant = (
            role == "IRRELEVANT"
            and confidence >= 0.90
            and relevance <= 0.10
        )

        # Mandatory and recognized critical evidence remain protected.
        # Structured numeric constraints are protected only when the
        # semantic model does not strongly reject them for this task.
        if (
            atom.facet_score >= 0.58
            and (
                atom.mandatory
                or detect_critical_feature({"sentence": atom.text}) is not None
                or (
                    atom.structured_constraints
                    and not strongly_irrelevant
                )
            )
        ):
            return False

        return strongly_irrelevant

    selected: list[FactAtom] = []
    selected_ids: set[str] = set()
    used_tokens = 0
    facet_counts = {facet: 0 for facet in facets}
    page_counts: dict[int, int] = {}

    def add(atom: FactAtom) -> bool:
        nonlocal used_tokens

        if atom.atom_id in selected_ids:
            return False

        cost = max(1, int(token_costs.get(atom.atom_id, 1)))

        if used_tokens + cost > token_budget:
            return False

        selected.append(atom)
        selected_ids.add(atom.atom_id)
        used_tokens += cost

        if atom.facet:
            facet_counts[atom.facet] = facet_counts.get(atom.facet, 0) + 1

        if atom.page is not None:
            page_counts[atom.page] = page_counts.get(atom.page, 0) + 1

        return True

    eligible = [
        atom
        for atom in atoms
        if not atom.negative_terms
        and not is_guarded_irrelevant(atom)
        and atom.facet is not None
        and atom.facet_score >= (0.20 if atom.hard else 0.42)
    ]

    # Phase 0: protect only proven critical fact classes.
    # This reuses the Step 14 detector at fact granularity without globally
    # promoting generic mandatory prose.
    critical_atoms = [
        atom
        for atom in eligible
        if detect_critical_feature({"sentence": atom.text}) is not None
    ]

    critical_atoms.sort(
        key=lambda atom: (
            detect_critical_feature({"sentence": atom.text}).score,
            _value(atom),
            len(atom.structured_constraints),
            1 if atom.has_number else 0,
            -token_costs.get(atom.atom_id, 1),
        ),
        reverse=True,
    )

    critical_kind_counts: dict[str, int] = {}
    critical_facet_counts: dict[str, int] = {}
    critical_added = 0
    critical_max = min(14, max(6, len(facets) + 5))

    for atom in critical_atoms:
        feature = detect_critical_feature({"sentence": atom.text})
        if feature is None:
            continue

        if critical_added >= critical_max:
            break

        if critical_kind_counts.get(feature.kind, 0) >= 3:
            continue

        facet_key = atom.facet or "__none__"
        if critical_facet_counts.get(facet_key, 0) >= 4:
            continue

        if add(atom):
            critical_kind_counts[feature.kind] = critical_kind_counts.get(feature.kind, 0) + 1
            critical_facet_counts[facet_key] = critical_facet_counts.get(facet_key, 0) + 1
            critical_added += 1

    # Phase A: establish requested-facet coverage.
    #
    # Prefer intrinsic hard evidence. When a facet has no hard evidence,
    # allow one strongly relevant semantic REQUIRED/SUPPORTING atom to
    # establish coverage. This protects exact descriptive facts such as
    # endpoint names and deprecation dates without globally promoting
    # BACKGROUND text to hard evidence.
    for facet in facets:
        hard_candidates = [
            atom
            for atom in eligible
            if atom.facet == facet and atom.hard
        ]

        hard_candidates.sort(
            key=lambda atom: (
                _value(atom),
                len(atom.structured_constraints),
                1 if atom.has_number else 0,
                1 if atom.mandatory else 0,
                -token_costs.get(atom.atom_id, 1),
            ),
            reverse=True,
        )

        if hard_candidates:
            for atom in hard_candidates[:facet_floor]:
                add(atom)

            continue

        semantic_candidates = []

        for atom in eligible:
            if atom.facet != facet or atom.hard:
                continue

            prediction = semantic_roles.get(atom.atom_id)
            if prediction is None:
                continue

            role = str(
                getattr(prediction, "role", "") or ""
            ).upper()

            confidence = float(
                getattr(prediction, "confidence", 0.0) or 0.0
            )

            relevance = float(
                getattr(prediction, "relevance", 0.0) or 0.0
            )

            if (
                role in {"REQUIRED", "SUPPORTING"}
                and confidence >= 0.53
                and relevance >= 0.72
            ):
                semantic_candidates.append(
                    (
                        atom,
                        confidence,
                        relevance,
                    )
                )

        semantic_candidates.sort(
            key=lambda entry: (
                entry[2],
                entry[1],
                _value(entry[0]),
                -token_costs.get(entry[0].atom_id, 1),
            ),
            reverse=True,
        )

        if semantic_candidates:
            add(semantic_candidates[0][0])

    # Phase B: global hard-fact completion with diversity and cost awareness.
    remaining_hard = [
        atom
        for atom in eligible
        if atom.hard and atom.atom_id not in selected_ids
    ]

    while remaining_hard:
        best: FactAtom | None = None
        best_gain = float("-inf")

        for atom in remaining_hard:
            cost = max(1, int(token_costs.get(atom.atom_id, 1)))

            if used_tokens + cost > token_budget:
                continue

            facet_count = facet_counts.get(atom.facet or "", 0)
            facet_bonus = (
                0.20 if facet_count == 0
                else 0.10 if facet_count < facet_floor
                else 0.025
            )

            page_count = page_counts.get(atom.page, 0) if atom.page is not None else 0
            page_bonus = 0.07 if page_count == 0 else max(0.0, 0.025 - page_count * 0.005)

            gain = (
                _value(atom)
                + facet_bonus
                + page_bonus
                - min(0.07, cost / max(1, token_budget) * 0.6)
            )

            if gain > best_gain:
                best_gain = gain
                best = atom

        if best is None:
            break

        add(best)
        remaining_hard.remove(best)

    # Phase C: useful soft context only if room remains.
    # Semantically strong REQUIRED/SUPPORTING background facts may participate,
    # while UNKNOWN evidence remains excluded.
    def is_semantically_required_soft(atom: FactAtom) -> bool:
        prediction = semantic_roles.get(atom.atom_id)
        if prediction is None:
            return False

        role = str(getattr(prediction, "role", "") or "").upper()
        confidence = float(getattr(prediction, "confidence", 0.0) or 0.0)
        relevance = float(getattr(prediction, "relevance", 0.0) or 0.0)

        return (
            role in {"REQUIRED", "SUPPORTING"}
            and confidence >= 0.53
            and relevance >= 0.70
        )

    soft = [
        atom
        for atom in eligible
        if not atom.hard
        and atom.atom_id not in selected_ids
        and atom.evidence_type != "UNKNOWN"
        and (
            atom.evidence_type != "BACKGROUND"
            or is_semantically_required_soft(atom)
        )
        and not is_semantically_irrelevant_soft(atom)
    ]

    soft.sort(
        key=lambda atom: (
            _value(atom) / (1.0 + token_costs.get(atom.atom_id, 1) / 40.0),
            _value(atom),
        ),
        reverse=True,
    )

    for atom in soft:
        add(atom)

    return FactCompileResult(
        selected_atom_ids=tuple(atom.atom_id for atom in selected),
        atoms_considered=len(eligible),
        hard_atoms_considered=sum(1 for atom in eligible if atom.hard),
        selected_atoms=len(selected),
        used_tokens=used_tokens,
        facet_counts=dict(facet_counts),
        pages=tuple(sorted(page_counts)),
    )
