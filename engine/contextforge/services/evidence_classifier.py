from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum


class EvidenceType(str, Enum):
    NUMERIC_CONSTRAINT = "NUMERIC_CONSTRAINT"
    DEADLINE = "DEADLINE"
    THRESHOLD = "THRESHOLD"
    SECURITY_CONTROL = "SECURITY_CONTROL"
    PROHIBITION = "PROHIBITION"
    REQUIREMENT = "REQUIREMENT"
    EXCEPTION = "EXCEPTION"
    BACKGROUND = "BACKGROUND"


@dataclass(frozen=True)
class EvidenceClassification:
    primary: EvidenceType
    labels: tuple[EvidenceType, ...]
    strength: float
    has_number: bool
    has_unit: bool
    has_constraint: bool
    has_security_signal: bool
    has_exception_signal: bool


_NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?\b")
_UNIT_RE = re.compile(
    r"\b(?:ms|milliseconds?|seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|"
    r"%|percent|mb|gb|tb|kb|connections?|attempts?|retries?|times?|ports?)\b",
    re.IGNORECASE,
)
_DEADLINE_RE = re.compile(
    r"\b(?:within|no later than|by|before|after)\s+\d+(?:\.\d+)?\s*"
    r"(?:minutes?|hours?|days?|weeks?|months?|years?)\b",
    re.IGNORECASE,
)
_THRESHOLD_RE = re.compile(
    r"\b(?:exceeds?|above|below|greater than|less than|at least|at most|no more than|minimum|maximum|"
    r"threshold|p95|95th percentile|error rate|latency)\b",
    re.IGNORECASE,
)
_PROHIBITION_RE = re.compile(
    r"\b(?:must not|shall not|may not|prohibited|forbidden|not allowed|cannot)\b",
    re.IGNORECASE,
)
_REQUIREMENT_RE = re.compile(
    r"\b(?:must|shall|required|requires|requirement|needs to|is limited to|limited to|"
    r"is classified as|must include|must document|must remove|must be encrypted|"
    r"is conducted|is retained|is rejected|allows? \d+|expires? after)\b",
    re.IGNORECASE,
)
_EXCEPTION_RE = re.compile(
    r"\b(?:exception|unless|except|waiver|approved exception|jointly approve)\b",
    re.IGNORECASE,
)
_DIRECT_SECURITY_RE = re.compile(
    r"\b(?:authentication|authorization|mfa|multi[- ]factor|jwt|token|password|"
    r"encrypt(?:ed|ion|ing)?|security|access control|audit|pii|secret|key service|"
    r"lockout|service desk|on-call)\b",
    re.IGNORECASE,
)

# Domain nouns are not security controls by themselves.  "deployment",
# "database", "backup", etc. become control evidence only when the sentence
# also carries an actual obligation/constraint signal.
_CONTROL_DOMAIN_RE = re.compile(
    r"\b(?:incident|backup|recovery|database|deployment|retention)\b",
    re.IGNORECASE,
)


def classify_evidence(sentence: str) -> EvidenceClassification:
    text = sentence.strip()

    has_number = bool(_NUMBER_RE.search(text))
    has_unit = bool(_UNIT_RE.search(text))
    has_deadline = bool(_DEADLINE_RE.search(text))
    has_threshold = bool(_THRESHOLD_RE.search(text))
    has_prohibition = bool(_PROHIBITION_RE.search(text))
    has_requirement = bool(_REQUIREMENT_RE.search(text))
    has_exception = bool(_EXCEPTION_RE.search(text))
    has_direct_security = bool(_DIRECT_SECURITY_RE.search(text))
    has_control_domain = bool(_CONTROL_DOMAIN_RE.search(text))

    has_security = bool(
        has_direct_security
        or (
            has_control_domain
            and (
                has_prohibition
                or has_requirement
                or has_threshold
                or has_deadline
                or (
                    has_number
                    and has_unit
                )
            )
        )
    )

    labels: list[EvidenceType] = []

    if has_deadline:
        labels.append(EvidenceType.DEADLINE)

    if has_threshold:
        labels.append(EvidenceType.THRESHOLD)

    # A number inside an identifier (for example AES-256, TLS 1.3, ISO 27001)
    # is not automatically a numeric constraint. Require quantitative semantics.
    has_numeric_constraint = (
        has_number
        and (
            has_unit
            or has_threshold
            or has_deadline
            or bool(
                re.search(
                    r"\b(?:limited to|allows?|maximum|minimum|at least|at most|"
                    r"no more than|exactly|up to)\s+\d+(?:\.\d+)?\b",
                    text,
                    re.IGNORECASE,
                )
            )
        )
    )

    if has_numeric_constraint:
        labels.append(EvidenceType.NUMERIC_CONSTRAINT)

    if has_prohibition:
        labels.append(EvidenceType.PROHIBITION)

    if has_requirement:
        labels.append(EvidenceType.REQUIREMENT)

    if has_security:
        labels.append(EvidenceType.SECURITY_CONTROL)

    if has_exception:
        labels.append(EvidenceType.EXCEPTION)

    if not labels:
        labels.append(EvidenceType.BACKGROUND)

    # Primary label priority favors the kinds of evidence ContextForge most
    # needs to preserve under compression.
    priority = (
        EvidenceType.DEADLINE,
        EvidenceType.THRESHOLD,
        EvidenceType.NUMERIC_CONSTRAINT,
        EvidenceType.PROHIBITION,
        EvidenceType.REQUIREMENT,
        EvidenceType.SECURITY_CONTROL,
        EvidenceType.EXCEPTION,
        EvidenceType.BACKGROUND,
    )

    primary = next(label for label in priority if label in labels)

    strength = 0.0
    if EvidenceType.DEADLINE in labels:
        strength += 0.24
    if EvidenceType.THRESHOLD in labels:
        strength += 0.22
    if EvidenceType.NUMERIC_CONSTRAINT in labels:
        strength += 0.22
    if EvidenceType.PROHIBITION in labels:
        strength += 0.18
    if EvidenceType.REQUIREMENT in labels:
        strength += 0.16
    if EvidenceType.SECURITY_CONTROL in labels:
        strength += 0.08
    if EvidenceType.EXCEPTION in labels:
        strength += 0.08

    strength = min(1.0, strength)

    return EvidenceClassification(
        primary=primary,
        labels=tuple(dict.fromkeys(labels)),
        strength=strength,
        has_number=has_number,
        has_unit=has_unit,
        has_constraint=(
            has_deadline
            or has_threshold
            or has_prohibition
            or has_requirement
        ),
        has_security_signal=has_security,
        has_exception_signal=has_exception,
    )
