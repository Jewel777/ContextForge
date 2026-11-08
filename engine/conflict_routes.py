from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from auth_contract import AuthenticationUnavailable, resolve_principal
from conflict_audit import ConflictAuditStore
from persistence import PersistenceSettings, WorkspacePersistence

router = APIRouter()
_settings = PersistenceSettings.from_env()
_workspace_store = WorkspacePersistence(_settings)
_audit_store = ConflictAuditStore(_settings, _workspace_store)


class ConflictDetectedPayload(BaseModel):
    workspace_id: str
    key: str
    expected_revision: int
    actual_revision: int
    local_action: str


class ConflictResolutionPayload(BaseModel):
    workspace_id: str
    conflict_id: str
    resolution: str


def _principal(
    principal_id: str | None,
    principal_name: str | None,
):
    if not _settings.enabled:
        raise HTTPException(
            status_code=503,
            detail="Server persistence is disabled.",
        )

    try:
        return resolve_principal(
            {
                "x-contextforge-principal-id": principal_id or "",
                "x-contextforge-principal-name": principal_name or "",
            }
        )
    except AuthenticationUnavailable as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/workspace-conflicts/detected")
def record_conflict_detected(
    payload: ConflictDetectedPayload,
    principal_id: str | None = Header(
        default=None,
        alias="x-contextforge-principal-id",
    ),
    principal_name: str | None = Header(
        default=None,
        alias="x-contextforge-principal-name",
    ),
):
    principal = _principal(principal_id, principal_name)

    try:
        record = _audit_store.record_detected(
            principal_id=principal.id,
            workspace_id=payload.workspace_id,
            key=payload.key,
            expected_revision=payload.expected_revision,
            actual_revision=payload.actual_revision,
            local_action=payload.local_action,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return asdict(record)


@router.post("/workspace-conflicts/resolve")
def resolve_conflict(
    payload: ConflictResolutionPayload,
    principal_id: str | None = Header(
        default=None,
        alias="x-contextforge-principal-id",
    ),
    principal_name: str | None = Header(
        default=None,
        alias="x-contextforge-principal-name",
    ),
):
    principal = _principal(principal_id, principal_name)

    try:
        record = _audit_store.resolve(
            principal_id=principal.id,
            workspace_id=payload.workspace_id,
            conflict_id=payload.conflict_id,
            resolution=payload.resolution,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return asdict(record)


@router.get("/workspace-conflicts")
def list_conflicts(
    workspace_id: str = Query(..., min_length=1, max_length=160),
    limit: int = Query(default=50, ge=1, le=200),
    principal_id: str | None = Header(
        default=None,
        alias="x-contextforge-principal-id",
    ),
    principal_name: str | None = Header(
        default=None,
        alias="x-contextforge-principal-name",
    ),
):
    principal = _principal(principal_id, principal_name)

    try:
        records = _audit_store.list_recent(
            principal_id=principal.id,
            workspace_id=workspace_id,
            limit=limit,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return {
        "workspace_id": workspace_id,
        "records": [asdict(record) for record in records],
    }
