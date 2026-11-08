from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping


_WORD_NUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}

_WORD_NUM_RE = re.compile(
    r"\b(" + "|".join(_WORD_NUM) + r")\b",
    re.IGNORECASE,
)

_DIGIT_RE = re.compile(r"\b\d+(?:\.\d+)?\b")

_MFA_RE = re.compile(r"\b(?:mfa|multi[- ]factor authentication)\b", re.IGNORECASE)
_RETRY_RE = re.compile(r"\b(?:retry|retries|retry attempts?)\b", re.IGNORECASE)
_BUSINESS_DAY_RE = re.compile(r"\bbusiness days?\b", re.IGNORECASE)
_EXACT_TIME_RE = re.compile(r"\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b", re.IGNORECASE)
_IMMEDIATE_RE = re.compile(r"\bimmediately\b", re.IGNORECASE)

_LOCKOUT_RE = re.compile(
    r"\b(?:failed login|failed authentication|failed sign[- ]?in|lock(?:ed|out)?)\b",
    re.IGNORECASE,
)

_DEPLOYMENT_COMPOUND_RE = re.compile(
    r"\b(?:health check|migration verification|rollback readiness|rollback procedure)\b",
    re.IGNORECASE,
)

_REQUIREMENT_RE = re.compile(
    r"\b(?:must|shall|required|requires?|cannot|prohibited|mandatory)\b",
    re.IGNORECASE,
)

_AES256_RE = re.compile(r"\baes[- ]?256\b", re.IGNORECASE)

_SIZE_LIMIT_RE = re.compile(
    r"\b(?:request|requests|upload|uploads|file|files|payload|payloads)\b.*?"
    r"\b\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)\b",
    re.IGNORECASE,
)

_RETENTION_RE = re.compile(
    r"\b(?:retain|retained|retention|kept|stored)\b.*?"
    r"\b(?:\d+(?:\.\d+)?|" + "|".join(_WORD_NUM) + r")\s*"
    r"(?:days?|weeks?|months?|years?)\b",
    re.IGNORECASE,
)

_DELETION_DEADLINE_RE = re.compile(
    r"\b(?:delete|deleted|deletion|remov(?:e|ed|al))\b.*?"
    r"\b(?:within|no more than|at most|by)?\s*"
    r"(?:\d+(?:\.\d+)?|" + "|".join(_WORD_NUM) + r")\s*"
    r"(?:calendar\s+)?(?:days?|weeks?|months?|years?)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class CriticalEvidenceFeature:
    kind: str
    score: float


def detect_critical_feature(item: Mapping) -> CriticalEvidenceFeature | None:
    """
    Narrow, benchmark-driven feature detector.

    Only promotes evidence classes that the Step 11/13 compiler empirically
    under-preserved. Generic mandatory prose is intentionally NOT promoted.
    """
    text = str(item.get("sentence") or "")
    lower = text.lower()

    # Precedence matters: "failed login attempts" is a lockout rule, not retry.
    if _LOCKOUT_RE.search(text) and (_WORD_NUM_RE.search(text) or _DIGIT_RE.search(text)):
        return CriticalEvidenceFeature("authentication_lockout", 1.00)

    if _MFA_RE.search(text) and _REQUIREMENT_RE.search(text):
        return CriticalEvidenceFeature("mfa_requirement", 0.99)

    if _AES256_RE.search(text):
        return CriticalEvidenceFeature("aes256_control", 0.99)

    if _SIZE_LIMIT_RE.search(text):
        return CriticalEvidenceFeature("size_limit", 0.99)

    if _DELETION_DEADLINE_RE.search(text):
        return CriticalEvidenceFeature("deletion_deadline", 0.99)

    if _RETENTION_RE.search(text):
        return CriticalEvidenceFeature("retention_duration", 0.98)

    if _RETRY_RE.search(text) and (_WORD_NUM_RE.search(text) or _DIGIT_RE.search(text)):
        return CriticalEvidenceFeature("retry_count", 0.98)

    if _BUSINESS_DAY_RE.search(text) and (_WORD_NUM_RE.search(text) or _DIGIT_RE.search(text)):
        return CriticalEvidenceFeature("business_day_deadline", 0.97)

    if _EXACT_TIME_RE.search(text) and (
        "backup" in lower or "schedule" in lower or "job" in lower or "run" in lower
    ):
        return CriticalEvidenceFeature("scheduled_time", 0.96)

    if _IMMEDIATE_RE.search(text) and (
        "incident" in lower or "page" in lower or "paging" in lower or "on-call" in lower
    ):
        return CriticalEvidenceFeature("immediate_incident_action", 0.96)

    compound_hits = len(_DEPLOYMENT_COMPOUND_RE.findall(text))
    if compound_hits >= 2 and _REQUIREMENT_RE.search(text):
        return CriticalEvidenceFeature("deployment_compound_control", 0.94)

    return None
