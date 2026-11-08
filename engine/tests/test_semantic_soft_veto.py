from types import SimpleNamespace

from contextforge.services.fact_atomizer_v2 import atomize_scored_items
from contextforge.services.fact_level_compiler_semantic_v3 import compile_fact_atoms


def row(index, sentence, facet, score=0.90):
    return {
        "source_index": index,
        "sentence": sentence,
        "page": index + 1,
        "section": "Test",
        "facet_scores": {facet: score},
        "best_facet": facet,
        "best_facet_score": score,
        "semantic_score": score,
        "priority_score": score,
        "reranker_score": score,
        "negative_terms": set(),
    }


def test_semantic_soft_veto():
    rows = [
        row(0, "Requests larger than 25 MB are rejected.", "deployment"),
        row(1, "The marketing dashboard is reviewed every Monday.", "deployment"),
        row(2, "The engineering stand-up meeting occurs each morning.", "deployment"),
    ]

    atoms = atomize_scored_items(
        scored=rows,
        facets=["deployment"],
    )

    by_text = {atom.text.lower(): atom for atom in atoms}

    roles = {}
    for atom in atoms:
        text = atom.text.lower()
        if "marketing dashboard" in text or "stand-up" in text:
            roles[atom.atom_id] = SimpleNamespace(
                role="IRRELEVANT",
                confidence=0.95,
                relevance=0.05,
            )

    costs = {atom.atom_id: 16 for atom in atoms}

    result = compile_fact_atoms(
        atoms=atoms,
        facets=["deployment"],
        token_costs=costs,
        token_budget=100,
        facet_floor=2,
        semantic_roles=roles,
    )

    chosen = [
        atom.text.lower()
        for atom in atoms
        if atom.atom_id in set(result.selected_atom_ids)
    ]
    joined = " ".join(chosen)

    assert "25 mb" in joined
    assert "marketing dashboard" not in joined
    assert "stand-up" not in joined

    print("PASS - semantic soft-veto smoke test")
    print(result)
    print("selected:", chosen)


if __name__ == "__main__":
    test_semantic_soft_veto()
