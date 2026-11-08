from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Optional


@dataclass(frozen=True)
class ConstraintFact:
    subject: str
    metric: str
    operator: str
    value: str
    unit: Optional[str]
    kind: str
    raw_text: str

    def to_dict(self) -> dict:
        return asdict(self)


_NUMBER = r"\d+(?:\.\d+)?"
_UNIT = (
    r"(?:ms|milliseconds?|seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|"
    r"%|percent|kb|mb|gb|tb|connections?|attempts?|retries?|times?)"
)

_TIME_UNIT_NORMALIZATION = {
    "sec": "seconds",
    "secs": "seconds",
    "second": "seconds",
    "seconds": "seconds",
    "min": "minutes",
    "mins": "minutes",
    "minute": "minutes",
    "minutes": "minutes",
    "hr": "hours",
    "hrs": "hours",
    "hour": "hours",
    "hours": "hours",
    "day": "days",
    "days": "days",
    "week": "weeks",
    "weeks": "weeks",
    "month": "months",
    "months": "months",
    "year": "years",
    "years": "years",
    "%": "%",
    "percent": "%",
    "kb": "KB",
    "mb": "MB",
    "gb": "GB",
    "tb": "TB",
    "connection": "connections",
    "connections": "connections",
    "attempt": "attempts",
    "attempts": "attempts",
    "retry": "retries",
    "retries": "retries",
    "time": "times",
    "times": "times",
}


def _normalize_unit(unit: Optional[str]) -> Optional[str]:
    if not unit:
        return None
    key = unit.lower()
    return _TIME_UNIT_NORMALIZATION.get(key, unit)


def _clean_subject(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip(" .,:;()")
    text = re.sub(
        r"^(?:the|a|an)\s+",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return text


def _make(
    sentence: str,
    *,
    subject: str,
    metric: str,
    operator: str,
    value: str,
    unit: Optional[str],
    kind: str,
) -> ConstraintFact:
    return ConstraintFact(
        subject=_clean_subject(subject),
        metric=metric,
        operator=operator,
        value=value,
        unit=_normalize_unit(unit),
        kind=kind,
        raw_text=sentence.strip(),
    )


def extract_constraints(sentence: str) -> list[ConstraintFact]:
    """
    Extract concrete, machine-readable constraints from one sentence.

    This module is deliberately deterministic. It focuses on the kinds of
    evidence ContextForge must preserve under compression: limits, deadlines,
    thresholds, lifetimes, recovery objectives, ports, retries, retention,
    and schedule/frequency requirements.
    """
    text = re.sub(r"\s+", " ", sentence.strip())
    lower = text.lower()
    facts: list[ConstraintFact] = []

    # RTO / RPO
    for acronym, metric in (("RTO", "recovery_time_objective"), ("RPO", "recovery_point_objective")):
        pattern = re.compile(
            rf"(?P<subject>.+?)\b{acronym}\b[^0-9]{{0,40}}(?P<value>{_NUMBER})\s*(?P<unit>{_UNIT})",
            re.IGNORECASE,
        )
        m = pattern.search(text)
        if m:
            facts.append(
                _make(
                    text,
                    subject=m.group("subject"),
                    metric=metric,
                    operator="=",
                    value=m.group("value"),
                    unit=m.group("unit"),
                    kind="objective",
                )
            )

    # "... objective (...) is 4 hours" fallback for cases where acronym is in parentheses.
    if "recovery time objective" in lower and not any(f.metric == "recovery_time_objective" for f in facts):
        m = re.search(rf"recovery time objective.*?\bis\s+(?P<value>{_NUMBER})\s*(?P<unit>{_UNIT})", text, re.I)
        if m:
            subject = text[: text.lower().find("recovery time objective")]
            facts.append(_make(text, subject=subject, metric="recovery_time_objective", operator="=", value=m.group("value"), unit=m.group("unit"), kind="objective"))

    if "recovery point objective" in lower and not any(f.metric == "recovery_point_objective" for f in facts):
        m = re.search(rf"recovery point objective.*?\bis\s+(?P<value>{_NUMBER})\s*(?P<unit>{_UNIT})", text, re.I)
        if m:
            subject = text[: text.lower().find("recovery point objective")]
            facts.append(_make(text, subject=subject, metric="recovery_point_objective", operator="=", value=m.group("value"), unit=m.group("unit"), kind="objective"))

    # Port numbers.
    for m in re.finditer(r"\bport\s+(?P<value>\d{2,5})\b", text, re.I):
        subject = text[:m.start()] or "service"
        facts.append(_make(text, subject=subject, metric="port", operator="=", value=m.group("value"), unit=None, kind="network"))

    # Deadlines: "within 24 hours", "no later than 5 days"
    for m in re.finditer(
        rf"\b(?P<op>within|no later than|by)\s+(?P<value>{_NUMBER})\s*(?P<unit>{_UNIT})\b",
        text,
        re.I,
    ):
        op = "<=" if m.group("op").lower() in {"within", "no later than", "by"} else "="
        facts.append(
            _make(
                text,
                subject=text[:m.start()],
                metric="deadline",
                operator=op,
                value=m.group("value"),
                unit=m.group("unit"),
                kind="deadline",
            )
        )

    # Expiry/lifetime.
    m = re.search(
        rf"(?P<subject>.+?)\b(?:expire|expires|expired)\s+(?:after|in)\s+(?P<value>{_NUMBER})\s*(?P<unit>{_UNIT})",
        text,
        re.I,
    )
    if m:
        facts.append(
            _make(
                text,
                subject=m.group("subject"),
                metric="lifetime",
                operator="=",
                value=m.group("value"),
                unit=m.group("unit"),
                kind="lifetime",
            )
        )

    # Limited to / maximum / no more than / at most.
    limit_patterns = [
        (r"\blimited to\b", "<="),
        (r"\bno more than\b", "<="),
        (r"\bat most\b", "<="),
        (r"\bmaximum(?: of)?\b", "<="),
        (r"\bat least\b", ">="),
        (r"\bminimum(?: of)?\b", ">="),
    ]
    for phrase, operator in limit_patterns:
        m = re.search(
            rf"(?P<subject>.+?){phrase}\s+(?P<value>{_NUMBER})\s*(?P<unit>{_UNIT})?",
            text,
            re.I,
        )
        if m:
            facts.append(
                _make(
                    text,
                    subject=m.group("subject"),
                    metric="limit",
                    operator=operator,
                    value=m.group("value"),
                    unit=m.group("unit"),
                    kind="limit",
                )
            )

    # Request/file size thresholds.
    m = re.search(
        rf"(?P<subject>requests?|payloads?|files?)\s+(?:larger than|greater than|over)\s+(?P<value>{_NUMBER})\s*(?P<unit>kb|mb|gb|tb)\b",
        text,
        re.I,
    )
    if m:
        facts.append(
            _make(
                text,
                subject=m.group("subject"),
                metric="size_threshold",
                operator=">",
                value=m.group("value"),
                unit=m.group("unit"),
                kind="threshold",
            )
        )

    # Generic exceeds/below thresholds.
    m = re.search(
        rf"(?P<subject>.+?)\b(?P<op>exceeds?|greater than|above|below|less than)\s+(?P<value>{_NUMBER})\s*(?P<unit>{_UNIT})?",
        text,
        re.I,
    )
    if m:
        op_text = m.group("op").lower()
        operator = ">" if op_text in {"exceed", "exceeds", "greater than", "above"} else "<"
        facts.append(
            _make(
                text,
                subject=m.group("subject"),
                metric="threshold",
                operator=operator,
                value=m.group("value"),
                unit=m.group("unit"),
                kind="threshold",
            )
        )

    # Retry/attempt count.
    m = re.search(
        rf"(?:allows?|up to|maximum of)?\s*(?P<value>{_NUMBER})\s+(?P<unit>retry attempts?|retries|attempts?)\b",
        text,
        re.I,
    )
    if m:
        facts.append(
            _make(
                text,
                subject=text[:m.start()],
                metric="retry_count",
                operator="<=",
                value=m.group("value"),
                unit="retries",
                kind="retry",
            )
        )

    # Retention duration.
    m = re.search(
        rf"(?P<subject>.+?)\b(?:retained|retention(?: period)?(?: is)?|kept)\s+(?:for\s+)?(?P<value>{_NUMBER})\s*(?P<unit>{_UNIT})",
        text,
        re.I,
    )
    if m:
        facts.append(
            _make(
                text,
                subject=m.group("subject"),
                metric="retention",
                operator="=",
                value=m.group("value"),
                unit=m.group("unit"),
                kind="retention",
            )
        )

    # Frequency: twice per year / 3 times per month.
    word_number = {
        "once": "1",
        "twice": "2",
    }
    m = re.search(
        r"\b(?P<count>once|twice|\d+)\s+per\s+(?P<unit>day|week|month|year)\b",
        text,
        re.I,
    )
    if m:
        count = word_number.get(m.group("count").lower(), m.group("count"))
        facts.append(
            _make(
                text,
                subject=text[:m.start()],
                metric="frequency",
                operator="=",
                value=count,
                unit=f"per_{m.group('unit').lower()}",
                kind="frequency",
            )
        )

    # Exact clock-time schedule such as "at 2 AM".
    m = re.search(r"\bat\s+(?P<value>\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b", text, re.I)
    if m and any(token in lower for token in ("backup", "job", "run", "schedule")):
        facts.append(
            _make(
                text,
                subject=text[:m.start()],
                metric="scheduled_time",
                operator="=",
                value=m.group("value").upper().replace(" ", ""),
                unit=None,
                kind="schedule",
            )
        )

    # Deduplicate identical structured facts.
    deduped: list[ConstraintFact] = []
    seen = set()
    for fact in facts:
        key = (
            fact.subject.lower(),
            fact.metric,
            fact.operator,
            fact.value,
            fact.unit,
            fact.kind,
        )
        if key not in seen:
            seen.add(key)
            deduped.append(fact)

    return deduped
