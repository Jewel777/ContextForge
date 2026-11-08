from __future__ import annotations

from .context_manifest_schema import validate_explainability_manifest
from dataclasses import dataclass, asdict
from typing import Mapping, Sequence


@dataclass(frozen=True)
class FacetManifest:
    facet: str
    evidence_count: int
    hard_evidence_count: int
    numeric_evidence_count: int
    constraint_count: int
    pages: tuple[int, ...]
    covered: bool

    def to_dict(self) -> dict:
        data = asdict(self)
        data["pages"] = list(self.pages)
        return data


def build_context_manifest(
    *,
    selected: Sequence[Mapping],
    facets: Sequence[str],
    covered_facets: Sequence[str] | None = None,
) -> dict:
    """
    Build an explainable audit of what survived context compilation.

    The manifest is derived entirely from selected evidence and existing
    retrieval diagnostics. It does not alter ranking; it proves coverage.
    """
    facet_entries: list[FacetManifest] = []
    authoritative_covered_facets = (
        set(covered_facets)
        if covered_facets is not None
        else None
    )

    total_constraints = 0
    numeric_units = 0
    explicit_negatives = 0
    evidence_types: dict[str, int] = {}
    page_set: set[int] = set()

    for item in selected:
        total_constraints += int(item.get("constraint_count") or 0)

        if item.get("has_number"):
            numeric_units += 1

        if item.get("negative_terms"):
            explicit_negatives += 1

        evidence_type = item.get("evidence_type") or "UNKNOWN"
        evidence_types[evidence_type] = evidence_types.get(evidence_type, 0) + 1

        page = item.get("page")
        if isinstance(page, int):
            page_set.add(page)

    for facet in facets:
        supporting = [
            item
            for item in selected
            if float(item.get("facet_scores", {}).get(facet, 0.0)) >= 0.50
            and not item.get("negative_terms")
        ]

        if (
            authoritative_covered_facets is not None
            and facet not in authoritative_covered_facets
        ):
            supporting = []

        pages = sorted(
            {
                item.get("page")
                for item in supporting
                if isinstance(item.get("page"), int)
            }
        )

        hard_evidence_count = sum(
            1
            for item in supporting
            if (
                item.get("has_constraint")
                or int(item.get("constraint_count") or 0) > 0
                or float(item.get("evidence_strength") or 0.0) >= 0.18
            )
        )

        numeric_evidence_count = sum(
            1 for item in supporting if item.get("has_number")
        )

        constraint_count = sum(
            int(item.get("constraint_count") or 0)
            for item in supporting
        )

        facet_entries.append(
            FacetManifest(
                facet=facet,
                evidence_count=len(supporting),
                hard_evidence_count=hard_evidence_count,
                numeric_evidence_count=numeric_evidence_count,
                constraint_count=constraint_count,
                pages=tuple(pages),
                covered=(
                    facet in authoritative_covered_facets
                    if authoritative_covered_facets is not None
                    else bool(supporting)
                ),
            )
        )

    covered = sum(1 for entry in facet_entries if entry.covered)
    hard_covered = sum(1 for entry in facet_entries if entry.hard_evidence_count > 0)

    return {
        "facets": [entry.to_dict() for entry in facet_entries],
        "coverage": {
            "covered": covered,
            "total": len(facet_entries),
            "hard_fact_covered": hard_covered,
        },
        "selected_evidence_count": len(selected),
        "structured_constraint_count": total_constraints,
        "numeric_evidence_count": numeric_units,
        "explicit_negative_count": explicit_negatives,
        "pages_represented": sorted(page_set),
        "evidence_type_counts": evidence_types,
    }

# === ContextForge explainability manifest ===

def _manifest_value(item, key, default=None):
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def _manifest_text(item):
    for key in ("sentence", "text", "content"):
        value = _manifest_value(item, key)
        if value:
            return str(value)
    return ""


def _manifest_constraints(item):
    raw = (
        _manifest_value(item, "structured_constraints")
        or _manifest_value(item, "constraints")
        or []
    )
    out = []
    for value in raw:
        if hasattr(value, "to_dict"):
            value = value.to_dict()
        elif not isinstance(value, (dict, str, int, float, bool, type(None))):
            value = str(value)
        out.append(value)
    return out


def _manifest_labels(item):
    raw = (
        _manifest_value(item, "evidence_labels")
        or _manifest_value(item, "labels")
        or []
    )
    labels = []
    for value in raw:
        labels.append(getattr(value, "value", value))
    return [str(x) for x in labels]


def _build_explainability_manifest_unvalidated(
    *,
    task: str,
    selected_evidence,
    rejected_evidence=(),
    strategy: str | None = None,
    metrics: dict | None = None,
    requested_facets=(),
):
    """
    Build a provider-neutral explanation object for a compiled ContextForge result.
    This function is side-effect free and does not alter retrieval or packing.
    """

    def card(item, decision):
        text = _manifest_text(item)
        evidence_type = _manifest_value(item, "evidence_type", "UNKNOWN")
        evidence_type = getattr(evidence_type, "value", evidence_type)

        facet = (
            _manifest_value(item, "best_facet")
            or _manifest_value(item, "facet")
        )
        facet_score = (
            _manifest_value(item, "best_facet_score")
            if _manifest_value(item, "best_facet_score") is not None
            else _manifest_value(item, "facet_score")
        )

        matched_facets = _manifest_value(item, "matched_facets") or []

        semantic_role = _manifest_value(item, "semantic_role")
        semantic_confidence = _manifest_value(item, "semantic_confidence")
        semantic_relevance = _manifest_value(item, "semantic_relevance")

        hard = _manifest_value(item, "hard")
        mandatory = _manifest_value(item, "mandatory")
        has_number = _manifest_value(item, "has_number")
        page = _manifest_value(item, "page")
        source_id = _manifest_first_present(
            item,
            "source_id",
            "atom_id",
            "source_index",
            "id",
        )

        constraints = _manifest_constraints(item)
        reasons = []

        if mandatory:
            reasons.append("mandatory")
        if hard:
            reasons.append("hard_evidence")
        if has_number:
            reasons.append("numeric_evidence")
        if constraints:
            reasons.append("structured_constraint")
        if evidence_type not in (None, "", "UNKNOWN", "BACKGROUND"):
            reasons.append(f"evidence_type:{evidence_type}")
        if facet:
            reasons.append(f"facet:{facet}")

        for matched_facet in matched_facets:
            if matched_facet and matched_facet != facet:
                reasons.append(f"facet:{matched_facet}")

        if semantic_role:
            reasons.append(f"semantic_role:{semantic_role}")

        rejection_reason = _manifest_value(item, "rejection_reason")
        if decision == "rejected" and rejection_reason:
            reasons.append(f"rejected:{rejection_reason}")

        return {
            "decision": decision,
            "source_id": source_id,
            "text": text,
            "page": page,
            "facet": facet,
            "facet_score": facet_score,
            "matched_facets": list(matched_facets),
            "evidence_type": str(evidence_type) if evidence_type is not None else None,
            "evidence_labels": _manifest_labels(item),
            "mandatory": bool(mandatory) if mandatory is not None else None,
            "hard": bool(hard) if hard is not None else None,
            "has_number": bool(has_number) if has_number is not None else None,
            "structured_constraints": constraints,
            "semantic_role": semantic_role,
            "semantic_confidence": semantic_confidence,
            "semantic_relevance": semantic_relevance,
            "reasons": reasons,
        }

    kept = [card(item, "selected") for item in selected_evidence]
    rejected = [card(item, "rejected") for item in rejected_evidence]

    pages = sorted({
        item["page"]
        for item in kept
        if isinstance(item["page"], int)
    })

    facets = sorted({
        item["facet"]
        for item in kept
        if item["facet"]
    })

    evidence_types = {}
    for item in kept:
        key = item["evidence_type"] or "UNKNOWN"
        evidence_types[key] = evidence_types.get(key, 0) + 1

    return {
        "version": "2.0",
        "task": task,
        "requested_facets": [str(facet) for facet in requested_facets if facet],
        "strategy": strategy,
        "summary": {
            "selected_count": len(kept),
            "rejected_count": len(rejected),
            "facets_covered": facets,
            "pages_used": pages,
            "evidence_type_counts": evidence_types,
        },
        "metrics": dict(metrics or {}),
        "selected": kept,
        "rejected": rejected,
    }


# === ContextForge per-compile trust metrics ===

MANIFEST_TRUST_METRICS_VERSION = "1.0"


def _manifest_item_is_irrelevant(item: dict) -> bool:
    role = str(item.get("semantic_role") or "").upper()

    reasons = [
        str(reason).lower()
        for reason in (item.get("reasons") or [])
    ]

    return (
        role == "IRRELEVANT"
        or any(
            token in reason
            for reason in reasons
            for token in (
                "semantic_veto",
                "excluded_by_task_scope",
                "semantic_role:irrelevant",
                "semantic role:irrelevant",
            )
        )
    )


def _manifest_item_is_critical(item: dict) -> bool:
    return bool(
        item.get("mandatory")
        or item.get("hard")
        or item.get("structured_constraints")
    )


def _manifest_item_is_numeric(item: dict) -> bool:
    return bool(
        item.get("has_number")
        or any(
            str(reason).lower() == "numeric_evidence"
            for reason in (item.get("reasons") or [])
        )
    )


def _manifest_item_has_provenance(item: dict) -> bool:
    return (
        item.get("source_id") is not None
        or item.get("page") is not None
    )


def _ratio(selected: int, total: int) -> float:
    if total <= 0:
        return 1.0
    return selected / total


def _attach_manifest_trust_metrics(manifest: dict) -> dict:
    """
    Attach conservative, per-compile evidence-quality measurements.

    These values are derived only from the manifest's actual selected and
    rejected evidence. They do not alter retrieval, ranking, or packing.

    Rejected evidence explicitly classified as irrelevant to the requested
    task is excluded from recall denominators. This prevents correct
    distractor rejection from being misreported as evidence loss.
    """
    if not isinstance(manifest, dict):
        return manifest

    selected = [
        item
        for item in (manifest.get("selected") or [])
        if isinstance(item, dict)
    ]

    rejected = [
        item
        for item in (manifest.get("rejected") or [])
        if isinstance(item, dict)
    ]

    relevant_rejected = [
        item
        for item in rejected
        if not _manifest_item_is_irrelevant(item)
    ]

    relevant_all = selected + relevant_rejected

    selected_critical = [
        item for item in selected
        if _manifest_item_is_critical(item)
    ]
    all_critical = [
        item for item in relevant_all
        if _manifest_item_is_critical(item)
    ]

    selected_numeric = [
        item for item in selected
        if _manifest_item_is_numeric(item)
    ]
    all_numeric = [
        item for item in relevant_all
        if _manifest_item_is_numeric(item)
    ]

    selected_facets = set()

    for item in selected:
        matched = item.get("matched_facets") or []

        if matched:
            selected_facets.update(
                str(facet)
                for facet in matched
                if facet
            )
        elif item.get("facet"):
            selected_facets.add(str(item.get("facet")))

    relevant_facets = {
        str(item.get("facet"))
        for item in relevant_all
        if item.get("facet")
    }

    requested_facets = {
        str(facet)
        for facet in (manifest.get("requested_facets") or [])
        if facet
    }

    provenance_selected = sum(
        1
        for item in selected
        if _manifest_item_has_provenance(item)
    )

    critical_recall = _ratio(
        len(selected_critical),
        len(all_critical),
    )

    numeric_recall = _ratio(
        len(selected_numeric),
        len(all_numeric),
    )

    provenance_coverage = _ratio(
        provenance_selected,
        len(selected),
    )

    facet_denominator = requested_facets or relevant_facets

    authoritative_facet_coverage = None
    existing_metrics = manifest.get("metrics")
    if isinstance(existing_metrics, dict):
        value = existing_metrics.get("authoritative_facet_coverage")
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            value = float(value)
            if 0.0 <= value <= 1.0:
                authoritative_facet_coverage = value

    facet_coverage = (
        authoritative_facet_coverage
        if authoritative_facet_coverage is not None
        else _ratio(
            len(selected_facets & facet_denominator),
            len(facet_denominator),
        )
    )

    hard_evidence_complete = critical_recall >= 0.999999

    metrics = manifest.get("metrics")
    if not isinstance(metrics, dict):
        metrics = {}

    metrics = dict(metrics)

    metrics.update(
        {
            "trust_metrics_version": MANIFEST_TRUST_METRICS_VERSION,

            "critical_fact_recall": round(critical_recall, 6),
            "numeric_fact_recall": round(numeric_recall, 6),
            "provenance_coverage": round(provenance_coverage, 6),
            "facet_coverage": round(facet_coverage, 6),
            "hard_evidence_complete": hard_evidence_complete,

            "critical_fact_counts": {
                "selected": len(selected_critical),
                "relevant_total": len(all_critical),
            },

            "numeric_fact_counts": {
                "selected": len(selected_numeric),
                "relevant_total": len(all_numeric),
            },

            "provenance_counts": {
                "traceable": provenance_selected,
                "selected_total": len(selected),
            },

"facet_counts": {
    "covered": len(selected_facets & facet_denominator),
    "relevant_total": len(facet_denominator),
},

            "irrelevant_rejected_count": len(rejected) - len(relevant_rejected),
            "relevant_rejected_count": len(relevant_rejected),
        }
    )

    manifest["metrics"] = metrics

    # Convenience field consumed by existing defensive Standard Trust logic.
    manifest["hard_evidence_complete"] = hard_evidence_complete

    return manifest



# === ContextForge authoritative Trust verdict ===

MANIFEST_TRUST_VERDICT_VERSION = "1.0"


def _build_manifest_trust_verdict(manifest: dict) -> dict:
    """
    Produce the authoritative per-compile Trust verdict.

    Trust is derived exclusively from evidence-quality measurements already
    attached to this manifest. It never changes retrieval, ranking, selection,
    compression, or packing.
    """
    metrics = manifest.get("metrics")
    if not isinstance(metrics, dict):
        metrics = {}

    def number(name):
        value = metrics.get(name)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            value = float(value)
            if 0.0 <= value <= 1.0:
                return value
        return None

    checks = []

    def add_check(key, label, value, threshold=0.999999):
        if value is None:
            checks.append({
                "id": key,
                "label": label,
                "status": "unavailable",
                "value": None,
            })
            return

        checks.append({
            "id": key,
            "label": label,
            "status": "pass" if value >= threshold else "review",
            "value": round(value, 6),
        })

    add_check(
        "critical_evidence",
        "Critical evidence",
        number("critical_fact_recall"),
    )

    add_check(
        "numeric_preservation",
        "Numeric preservation",
        number("numeric_fact_recall"),
    )

    add_check(
        "provenance",
        "Provenance",
        number("provenance_coverage"),
    )

    add_check(
        "objective_coverage",
        "Objective coverage",
        number("facet_coverage"),
        threshold=0.95,
    )

    hard_complete = metrics.get("hard_evidence_complete")

    if isinstance(hard_complete, bool):
        checks.append({
            "id": "hard_evidence",
            "label": "Hard evidence",
            "status": "pass" if hard_complete else "review",
            "value": hard_complete,
        })
    else:
        checks.append({
            "id": "hard_evidence",
            "label": "Hard evidence",
            "status": "unavailable",
            "value": None,
        })

    failed = [
        check
        for check in checks
        if check["status"] == "review"
    ]

    unavailable = [
        check
        for check in checks
        if check["status"] == "unavailable"
    ]

    if failed:
        state = "review"
        label = "Review recommended"
    elif unavailable:
        state = "limited"
        label = "Ready · limited verification"
    else:
        state = "verified"
        label = "Verified"

    return {
        "version": MANIFEST_TRUST_VERDICT_VERSION,
        "state": state,
        "label": label,
        "verified": state == "verified",
        "checks": checks,
        "passed_count": sum(
            1 for check in checks if check["status"] == "pass"
        ),
        "review_count": len(failed),
        "unavailable_count": len(unavailable),
    }



# === ContextForge provenance traceability ===

def _manifest_first_present(item, *keys):
    """
    Return the first explicitly present, non-None value.

    Important: integer zero is a valid source_index and must not be
    discarded by truthiness-based fallback logic.
    """
    for key in keys:
        value = _manifest_value(item, key)
        if value is not None:
            return value
    return None


def build_explainability_manifest(*args, **kwargs):
    manifest = _build_explainability_manifest_unvalidated(*args, **kwargs)

    rejected_input = kwargs.get("rejected_evidence")
    if rejected_input is None and len(args) >= 3:
        rejected_input = args[2]

    if rejected_input:
        rejected_input = list(rejected_input)
        manifest_rejected = manifest.get("rejected") or []

        for source_item, manifest_item in zip(rejected_input, manifest_rejected):
            explicit_reasons = (
                source_item.get("rejection_reasons")
                or source_item.get("reasons")
                or []
            )
            if explicit_reasons:
                manifest_item["reasons"] = list(dict.fromkeys(explicit_reasons))

            rejection_stage = source_item.get("rejection_stage")
            if rejection_stage:
                manifest_item["rejection_stage"] = rejection_stage

            for field in (
                "semantic_role",
                "semantic_confidence",
                "semantic_relevance",
            ):
                value = source_item.get(field)
                if value is not None:
                    manifest_item[field] = value

    manifest = _attach_manifest_trust_metrics(manifest)
    manifest["trust"] = _build_manifest_trust_verdict(manifest)
    return validate_explainability_manifest(manifest)
