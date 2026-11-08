from contextforge.services.context_manifest import build_explainability_manifest


def _attach(result, task):
    sources = result.get("sources") or []
    metrics = result.get("metrics") or {}
    strategy = (
        result.get("strategy")
        or metrics.get("retrieval_strategy")
        or metrics.get("strategy")
    )
    result["explainability_manifest"] = build_explainability_manifest(
        task=task,
        selected_evidence=sources,
        rejected_evidence=(),
        strategy=strategy,
        metrics=metrics,
    )
    return result


def test_api_explainability_manifest():
    payload = {
        "optimized_context": "JWT access tokens expire after 15 minutes.",
        "metrics": {
            "retrieval_strategy": "step16_plus_semantic_soft_veto",
            "confidence": 91,
        },
        "sources": [
            {
                "atom_id": "2:1",
                "sentence": "JWT access tokens expire after 15 minutes.",
                "page": 2,
                "best_facet": "authentication",
                "best_facet_score": 0.93,
                "evidence_type": "DEADLINE",
                "evidence_labels": ["DEADLINE", "SECURITY_CONTROL"],
                "has_number": True,
                "hard": True,
                "structured_constraints": [
                    {"kind": "lifetime", "value": 15, "unit": "minutes"}
                ],
            }
        ],
    }

    result = _attach(payload, "Extract authentication requirements.")

    assert "explainability_manifest" in result
    manifest = result["explainability_manifest"]
    assert manifest["version"] == "2.0"
    assert manifest["task"] == "Extract authentication requirements."
    assert manifest["strategy"] == "step16_plus_semantic_soft_veto"
    assert manifest["summary"]["selected_count"] == 1
    assert manifest["summary"]["facets_covered"] == ["authentication"]
    assert manifest["summary"]["pages_used"] == [2]
    assert manifest["selected"][0]["text"].startswith("JWT access tokens")
    assert manifest["selected"][0]["structured_constraints"][0]["value"] == 15

    print("PASS - API explainability manifest payload smoke test")
    print(manifest["summary"])


if __name__ == "__main__":
    test_api_explainability_manifest()
