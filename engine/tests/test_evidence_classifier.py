from contextforge.services.evidence_classifier import (
    EvidenceType,
    classify_evidence,
)


def test_evidence_classifier():
    cases = [
        (
            "JWT access tokens expire after 15 minutes.",
            {EvidenceType.NUMERIC_CONSTRAINT, EvidenceType.SECURITY_CONTROL},
        ),
        (
            "The production platform recovery time objective (RTO) is 4 hours.",
            {EvidenceType.NUMERIC_CONSTRAINT},
        ),
        (
            "An alert is triggered when the five-minute error rate exceeds 2.0% for two consecutive evaluation windows.",
            {EvidenceType.THRESHOLD, EvidenceType.NUMERIC_CONSTRAINT},
        ),
        (
            "Customer records must be encrypted at rest using AES-256.",
            {EvidenceType.REQUIREMENT, EvidenceType.SECURITY_CONTROL},
        ),
        (
            "Re-identification attempts are prohibited.",
            {EvidenceType.PROHIBITION},
        ),
        (
            "Services must report the incident within 24 hours.",
            {EvidenceType.DEADLINE, EvidenceType.NUMERIC_CONSTRAINT},
        ),
        (
            "The office cafeteria serves pizza on Fridays.",
            {EvidenceType.BACKGROUND},
        ),
    ]

    for sentence, expected in cases:
        result = classify_evidence(sentence)
        labels = set(result.labels)
        missing = expected - labels
        assert not missing, (sentence, missing, labels)
        print(
            result.primary.value,
            round(result.strength, 2),
            sentence,
        )

    print("PASS - evidence classifier smoke test")


if __name__ == "__main__":
    test_evidence_classifier()
