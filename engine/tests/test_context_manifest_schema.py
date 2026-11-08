from contextforge.services.context_manifest import build_explainability_manifest
from contextforge.services.context_manifest_schema import (
    EXPLAINABILITY_MANIFEST_SCHEMA_VERSION,
    ManifestValidationError,
    get_explainability_manifest_schema,
    validate_explainability_manifest,
)


def test_context_manifest_schema():
    selected = [
        {
            "sentence": "MFA is required for administrative accounts.",
            "source_id": 0,
            "page": 1,
            "facet": "authentication",
            "evidence_type": "SECURITY_CONTROL",
            "labels": ["mandatory"],
            "mandatory": True,
            "hard": True,
            "numeric": False,
            "structured_constraints": [],
            "semantic_role": "RELEVANT",
            "semantic_confidence": 0.99,
            "semantic_relevance": 0.99,
            "reasons": ["mandatory security control"],
        }
    ]

    manifest = build_explainability_manifest(
        task="Extract mandatory security requirements.",
        selected_evidence=selected,
        rejected_evidence=[],
        strategy="schema_test",
        metrics={"selected_count": 1},
    )

    validate_explainability_manifest(manifest)

    assert manifest["version"] == EXPLAINABILITY_MANIFEST_SCHEMA_VERSION
    assert manifest["selected"]
    assert isinstance(get_explainability_manifest_schema(), dict)

    broken = dict(manifest)
    broken["version"] = "999.0"

    try:
        validate_explainability_manifest(broken)
    except ManifestValidationError:
        pass
    else:
        raise AssertionError("Manifest version drift was not rejected")

    print("PASS - explainability manifest schema validation")
    print("version:", manifest["version"])
    print("selected:", len(manifest["selected"]))


if __name__ == "__main__":
    test_context_manifest_schema()
