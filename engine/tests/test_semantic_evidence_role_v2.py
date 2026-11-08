from contextforge.services.semantic_evidence_role_v2 import semantic_role_classifier


def test_semantic_evidence_role_v2():
    cases = [
        (
            "database requirements",
            [
                "Database exports cannot be stored on personal devices.",
                "The marketing dashboard is reviewed every Monday.",
            ],
        ),
        (
            "deployment requirements",
            [
                "Every production deployment must have a documented rollback procedure.",
                "The engineering stand-up meeting occurs each morning.",
            ],
        ),
    ]

    for task, sentences in cases:
        predictions = semantic_role_classifier.classify_many(
            task=task,
            evidence_texts=sentences,
        )

        assert all(p is not None for p in predictions), semantic_role_classifier.load_error

        for sentence, prediction in zip(sentences, predictions):
            print(
                f"{prediction.role:11s} "
                f"conf={prediction.confidence:.3f} "
                f"rel={prediction.relevance:.3f} "
                f"local={prediction.local_role:10s} | {sentence}"
            )

        relevant = predictions[0]
        distractor = predictions[1]

        assert relevant.role in {"REQUIRED", "PROHIBITED", "SUPPORTING"}
        assert relevant.relevance > distractor.relevance
        assert distractor.role in {"BACKGROUND", "IRRELEVANT", "SUPPORTING"}

    print("PASS - semantic evidence-role v2 facet-query smoke test")


if __name__ == "__main__":
    test_semantic_evidence_role_v2()

