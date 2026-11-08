from contextforge.services.constraint_extractor import extract_constraints


def first(sentence: str):
    facts = extract_constraints(sentence)
    assert facts, sentence
    return facts[0]


def test_constraint_extractor():
    fact = first("JWT access tokens expire after 15 minutes.")
    assert fact.metric == "lifetime"
    assert fact.value == "15"
    assert fact.unit == "minutes"

    fact = first("The database pool is limited to 30 connections.")
    assert fact.metric == "limit"
    assert fact.operator == "<="
    assert fact.value == "30"
    assert fact.unit == "connections"

    fact = first("Requests larger than 25 MB are rejected.")
    assert fact.metric == "size_threshold"
    assert fact.operator == ">"
    assert fact.value == "25"
    assert fact.unit == "MB"

    fact = first("The production platform recovery time objective (RTO) is 4 hours.")
    assert fact.metric == "recovery_time_objective"
    assert fact.value == "4"
    assert fact.unit == "hours"

    fact = first("The recovery point objective (RPO) for transactional customer data is 15 minutes.")
    assert fact.metric == "recovery_point_objective"
    assert fact.value == "15"
    assert fact.unit == "minutes"

    fact = first("An alert is triggered when the five-minute error rate exceeds 2.0% for two consecutive evaluation windows.")
    assert fact.metric == "threshold"
    assert fact.operator == ">"
    assert fact.value == "2.0"
    assert fact.unit == "%"

    facts = extract_constraints("The service allows three retry attempts with bounded exponential backoff.")
    assert facts == [], facts

    facts = extract_constraints("A full disaster-recovery exercise is conducted twice per year.")
    assert any(f.metric == "frequency" and f.value == "2" and f.unit == "per_year" for f in facts)

    facts = extract_constraints("The nightly backup job runs at 2 AM.")
    assert any(f.metric == "scheduled_time" and f.value == "2AM" for f in facts)

    print("PASS - constraint extractor smoke test")


if __name__ == "__main__":
    test_constraint_extractor()
