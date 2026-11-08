from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping


_WORD_NUMBERS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
}

_WORD_NUMBER_RE = re.compile(
    r"\b(" + "|".join(_WORD_NUMBERS) + r")\b",
    re.IGNORECASE,
)

_OBLIGATION_RE = re.compile(
    r"\b(?:must|shall|required|requires?|cannot|may not|must not|"
    r"prohibited|mandatory|is required to|are required to)\b",
    re.IGNORECASE,
)

_SECURITY_CONTROL_RE = re.compile(
    r"\b(?:mfa|multi[- ]factor authentication|aes[- ]?256|encrypt(?:ed|ion|ing)?|"
    r"access control|manager approval|authentication|authorization)\b",
    re.IGNORECASE,
)

_OPERATIONAL_CONTROL_RE = re.compile(
    r"\b(?:retry|retries|backup|rollback|health check|migration verification|"
    r"incident commander|status update|paging|page immediately|immediately|"
    r"retrospective review|schema migration)\b",
    re.IGNORECASE,
)

_TIME_RE = re.compile(
    r"\b(?:milliseconds?|seconds?|minutes?|hours?|business days?|calendar days?|"
    r"days?|weeks?|months?|years?)\b",
    re.IGNORECASE,
)

_EXACT_TIME_RE = re.compile(
    r"\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class EvidenceFeatures:
    mandatory: bool
    security_control: bool
    operational_control: bool
    word_number: int | None
    quantitative_phrase: bool
    immediate: bool
    exact_time: bool

    @property
    def hard(self) -> bool:
        return (
            self.mandatory
            or self.security_control
            or self.quantitative_phrase
            or self.immediate
            or self.exact_time
        )


def detect_evidence_features(item: Mapping) -> EvidenceFeatures:
    text = str(item.get("sentence") or "")

    word_number_match = _WORD_NUMBER_RE.search(text)
    word_number = (
        _WORD_NUMBERS[word_number_match.group(1).lower()]
        if word_number_match
        else None
    )

    mandatory = bool(_OBLIGATION_RE.search(text))
    security_control = bool(_SECURITY_CONTROL_RE.search(text))
    operational_control = bool(_OPERATIONAL_CONTROL_RE.search(text))

    quantitative_phrase = bool(
        word_number_match
        and (
            _TIME_RE.search(text)
            or operational_control
            or re.search(
                r"\b(?:attempts?|connections?|times?|failures?|retries?)\b",
                text,
                re.IGNORECASE,
            )
        )
    )

    immediate = bool(re.search(r"\bimmediately\b", text, re.IGNORECASE))
    exact_time = bool(_EXACT_TIME_RE.search(text))

    return EvidenceFeatures(
        mandatory=mandatory,
        security_control=security_control,
        operational_control=operational_control,
        word_number=word_number,
        quantitative_phrase=quantitative_phrase,
        immediate=immediate,
        exact_time=exact_time,
    )
