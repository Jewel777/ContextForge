from contextforge.services.evidence_classifier import classify_evidence
from contextforge.services.fact_atomizer_v2 import atomize_scored_items


def row(index, sentence, facet):
    return {
        "source_index": index,
        "sentence": sentence,
        "page": index + 1,
        "section": "Test",
        "facet_scores": {facet: 0.9},
        "best_facet": facet,
        "best_facet_score": 0.9,
        "semantic_score": 0.9,
        "priority_score": 0.9,
        "reranker_score": 0.9,
        "negative_terms": set(),
    }


def test_task_hard_evidence_model():
    # Broad domain nouns must not create SECURITY_CONTROL by themselves.
    a = classify_evidence("The deployment team stand-up occurs each morning.")
    b = classify_evidence("The marketing dashboard deployment review occurs every Monday.")
    assert a.primary.value == "BACKGROUND", a
    assert b.primary.value == "BACKGROUND", b

    # Real controls remain controls.
    c = classify_evidence("Database exports cannot be stored on personal devices.")
    d = classify_evidence("Every production deployment must have a documented rollback procedure.")
    assert "PROHIBITION" in {x.value for x in c.labels}, c
    assert "REQUIREMENT" in {x.value for x in d.labels}, d

    atoms = atomize_scored_items(
        scored=[
            row(0, "The deployment team stand-up occurs each morning.", "deployment"),
            row(1, "The marketing dashboard deployment review occurs every Monday.", "deployment"),
            row(2, "Database exports cannot be stored on personal devices.", "security"),
            row(3, "Every production deployment must have a documented rollback procedure.", "deployment"),
        ],
        facets=["security", "deployment"],
    )

    by_text = {a.text: a for a in atoms}
    assert not by_text["The deployment team stand-up occurs each morning."].hard
    assert not by_text["The marketing dashboard deployment review occurs every Monday."].hard
    assert by_text["Database exports cannot be stored on personal devices."].hard
    assert by_text["Every production deployment must have a documented rollback procedure."].hard

    print("PASS - task-hard evidence model")
    for atom in atoms:
        print(
            f"hard={str(atom.hard):5s} "
            f"type={atom.evidence_type:18s} | {atom.text}"
        )


if __name__ == "__main__":
    test_task_hard_evidence_model()
