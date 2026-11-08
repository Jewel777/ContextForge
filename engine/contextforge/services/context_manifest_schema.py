from __future__ import annotations

from copy import deepcopy
from typing import Any

EXPLAINABILITY_MANIFEST_SCHEMA_VERSION = "2.0"

EXPLAINABILITY_MANIFEST_SCHEMA: dict[str, Any] = {
    "$id": "contextforge.explainability-manifest.v2",
    "title": "ContextForge Explainability Manifest",
    "type": "object",
    "required": [
        "version",
        "selected",
        "rejected",
        "summary",
        "metrics",
        "strategy",
    ],
    "properties": {
        "version": {"const": EXPLAINABILITY_MANIFEST_SCHEMA_VERSION},
        "task": {"type": "string"},
        "strategy": {"type": "string"},
        "selected": {"type": "array"},
        "rejected": {"type": "array"},
        "summary": {"type": "object"},
        "metrics": {"type": "object"},
        "trust": {"type": "object"},
    },
}


class ManifestValidationError(ValueError):
    pass


def get_explainability_manifest_schema() -> dict[str, Any]:
    return deepcopy(EXPLAINABILITY_MANIFEST_SCHEMA)


def _validate_evidence_items(items: Any, field: str) -> None:
    if not isinstance(items, list):
        raise ManifestValidationError(f"{field} must be a list")

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ManifestValidationError(f"{field}[{index}] must be an object")

        text = item.get("text")
        if not isinstance(text, str) or not text.strip():
            raise ManifestValidationError(
                f"{field}[{index}].text must be a non-empty string"
            )

        reasons = item.get("reasons")
        if reasons is not None and not isinstance(reasons, list):
            raise ManifestValidationError(
                f"{field}[{index}].reasons must be a list when present"
            )

        constraints = item.get("structured_constraints")
        if constraints is not None and not isinstance(constraints, list):
            raise ManifestValidationError(
                f"{field}[{index}].structured_constraints must be a list when present"
            )


def validate_explainability_manifest(manifest: Any) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise ManifestValidationError("manifest must be an object")

    missing = [
        key
        for key in EXPLAINABILITY_MANIFEST_SCHEMA["required"]
        if key not in manifest
    ]
    if missing:
        raise ManifestValidationError(
            "manifest is missing required fields: " + ", ".join(missing)
        )

    if manifest.get("version") != EXPLAINABILITY_MANIFEST_SCHEMA_VERSION:
        raise ManifestValidationError(
            "unsupported manifest version: "
            f"{manifest.get('version')!r}; expected "
            f"{EXPLAINABILITY_MANIFEST_SCHEMA_VERSION!r}"
        )

    if not isinstance(manifest.get("strategy"), str):
        raise ManifestValidationError("strategy must be a string")

    if not isinstance(manifest.get("summary"), dict):
        raise ManifestValidationError("summary must be an object")

    if not isinstance(manifest.get("metrics"), dict):
        raise ManifestValidationError("metrics must be an object")

    task = manifest.get("task")
    if task is not None and not isinstance(task, str):
        raise ManifestValidationError("task must be a string when present")

    _validate_evidence_items(manifest.get("selected"), "selected")
    _validate_evidence_items(manifest.get("rejected"), "rejected")

    return manifest
