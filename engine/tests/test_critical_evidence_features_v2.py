from contextforge.services.critical_evidence_features_v2 import detect_critical_feature


def item(sentence):
    return {"sentence": sentence}


def test_critical_evidence_features_v2():
    cases = {
        "Five failed login attempts lock the account for 20 minutes.": "authentication_lockout",
        "Administrator accounts must use MFA.": "mfa_requirement",
        "Customer records must be encrypted at rest using AES-256.": "aes256_control",
        "Requests larger than 25 MB are rejected.": "size_limit",
        "Failed database connections retry three times before an error is surfaced.": "retry_count",
        "Nightly database backups run at 2 AM.": "scheduled_time",
        "Audit logs must be retained for 365 days.": "retention_duration",
        "Aggregated metrics are retained for 13 months.": "retention_duration",
        "Deletion requests must be completed within 30 calendar days.": "deletion_deadline",
        "Severity 1 incidents require paging the primary on-call engineer immediately.": "immediate_incident_action",
        "Emergency changes require retrospective review within one business day.": "business_day_deadline",
        "Production releases require health check, migration verification, and rollback readiness.": "deployment_compound_control",
    }

    for sentence, expected in cases.items():
        detected = detect_critical_feature(item(sentence))
        assert detected is not None, sentence
        assert detected.kind == expected, (sentence, detected.kind, expected)

    assert detect_critical_feature(item("Employees must attend orientation.")) is None

    print("PASS - critical evidence feature v2 smoke test")


if __name__ == "__main__":
    test_critical_evidence_features_v2()
