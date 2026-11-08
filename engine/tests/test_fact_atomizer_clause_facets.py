from contextforge.services.fact_atomizer_v2 import atomize_scored_items


def test_multiclause_sentence_reassigns_facet_per_clause():
    items = [
        {
            "source_index": 0,
            "sentence": (
                "The new endpoint is /v2/sync-stream; "
                "the deprecation date is March 31 2027."
            ),
            "facet_scores": {
                "new endpoint": 0.82,
                "deprecation date": 0.40,
            },
            "semantic_score": 0.8,
            "priority_score": 0.8,
            "reranker_score": 0.8,
            "negative_terms": set(),
        }
    ]

    atoms = atomize_scored_items(
        scored=items,
        facets=[
            "new endpoint",
            "deprecation date",
        ],
    )

    assert len(atoms) == 2

    endpoint_atom = atoms[0]
    date_atom = atoms[1]

    assert endpoint_atom.text == "The new endpoint is /v2/sync-stream"
    assert endpoint_atom.facet == "new endpoint"

    assert date_atom.text == "the deprecation date is March 31 2027."
    assert date_atom.facet == "deprecation date"

    assert date_atom.facet_score > 0.40