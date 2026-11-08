from contextforge.services.retrieval import optimize_sentences
from contextforge.services.text_utils import split_sentences


def make_items(text):
    return [
        {"sentence": sentence, "page": None, "section": None}
        for sentence in split_sentences(text)
    ]


def test_retrieval_false_positive_regression():
    text = (
        "The cafeteria serves lunch at noon. "
        "Authentication requires JWT tokens. "
        "Access tokens expire after 15 minutes. "
        "After five failed login attempts, the account is locked for 20 minutes."
    )

    positive_task = (
        "Extract all mandatory authentication, security, database, and deployment "
        "requirements. Preserve exact numeric limits and exclude unrelated "
        "operational details."
    )

    negative_task = (
        "Extract all database backup requirements, encryption-at-rest requirements, "
        "disaster recovery targets, and deployment region constraints."
    )

    positive = optimize_sentences(
        make_items(text),
        positive_task,
        "balanced",
        1000,
    )

    positive_output = positive["optimized_text"].lower()

    assert "authentication requires jwt tokens." in positive_output
    assert "access tokens expire after 15 minutes." in positive_output
    assert "after five failed login attempts" in positive_output
    assert "cafeteria" not in positive_output

    negative = optimize_sentences(
        make_items(text),
        negative_task,
        "balanced",
        1000,
    )

    negative_output = negative["optimized_text"].lower()

    assert "cafeteria" not in negative_output
    assert "access tokens expire after 15 minutes." not in negative_output
    assert "after five failed login attempts" not in negative_output
    assert "authentication requires jwt tokens." not in negative_output


    print("PASS - retrieval false-positive regression test")


if __name__ == "__main__":
    test_retrieval_false_positive_regression()
