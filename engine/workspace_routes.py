from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from auth_contract import AuthenticationUnavailable, resolve_principal
from concurrency import ConcurrentWorkspacePersistence, WorkspaceConflictError
from persistence import PersistenceSettings, WorkspacePersistence

router = APIRouter()
_settings = PersistenceSettings.from_env()
_base_store = WorkspacePersistence(_settings)
_store = ConcurrentWorkspacePersistence(_base_store)


class WorkspaceValue(BaseModel):
    value: Any
    expected_revision: int


def _resolve(
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
        raise HTTPException(
            status_code=401,
            detail=str(exc),
        ) from exc


def _ensure(
    principal_id: str,
    display_name: str,
    workspace_id: str,
) -> None:
    _base_store.ensure_principal(
        principal_id,
        display_name,
    )
    _base_store.ensure_workspace(
        workspace_id=workspace_id,
        owner_principal_id=principal_id,
        display_name=(
            "Personal workspace"
            if workspace_id == "personal"
            else workspace_id
        ),
    )


@router.get("/workspace-state")
def get_workspace_state(
    workspace_id: str = Query(..., min_length=1, max_length=160),
    key: str = Query(..., min_length=1, max_length=240),
    principal_id: str | None = Header(
        default=None,
        alias="x-contextforge-principal-id",
    ),
    principal_name: str | None = Header(
        default=None,
        alias="x-contextforge-principal-name",
    ),
):
    principal = _resolve(
        principal_id,
        principal_name,
    )
    _ensure(
        principal.id,
        principal.display_name,
        workspace_id,
    )

    try:
        record = _store.get_record(
            principal_id=principal.id,
            workspace_id=workspace_id,
            key=key,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc

    if record is None:
        return {
            "workspace_id": workspace_id,
            "key": key,
            "value": None,
            "revision": 0,
            "updated_at": None,
        }

    return {
        "workspace_id": workspace_id,
        "key": key,
        "value": record["value"],
        "revision": record["revision"],
        "updated_at": record["updated_at"],
    }


@router.put("/workspace-state")
def put_workspace_state(
    payload: WorkspaceValue,
    workspace_id: str = Query(..., min_length=1, max_length=160),
    key: str = Query(..., min_length=1, max_length=240),
    principal_id: str | None = Header(
        default=None,
        alias="x-contextforge-principal-id",
    ),
    principal_name: str | None = Header(
        default=None,
        alias="x-contextforge-principal-name",
    ),
):
    principal = _resolve(
        principal_id,
        principal_name,
    )
    _ensure(
        principal.id,
        principal.display_name,
        workspace_id,
    )

    try:
        revision = _store.put(
            principal_id=principal.id,
            workspace_id=workspace_id,
            key=key,
            value=payload.value,
            expected_revision=payload.expected_revision,
        )
    except WorkspaceConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "workspace_conflict",
                "expected_revision": exc.expected_revision,
                "actual_revision": exc.actual_revision,
            },
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc

    return {
        "workspace_id": workspace_id,
        "key": key,
        "stored": True,
        "revision": revision,
    }


@router.delete("/workspace-state")
def delete_workspace_state(
    workspace_id: str = Query(..., min_length=1, max_length=160),
    key: str = Query(..., min_length=1, max_length=240),
    expected_revision: int = Query(..., ge=0),
    principal_id: str | None = Header(
        default=None,
        alias="x-contextforge-principal-id",
    ),
    principal_name: str | None = Header(
        default=None,
        alias="x-contextforge-principal-name",
    ),
):
    principal = _resolve(
        principal_id,
        principal_name,
    )
    _ensure(
        principal.id,
        principal.display_name,
        workspace_id,
    )

    try:
        revision = _store.delete(
            principal_id=principal.id,
            workspace_id=workspace_id,
            key=key,
            expected_revision=expected_revision,
        )
    except WorkspaceConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "workspace_conflict",
                "expected_revision": exc.expected_revision,
                "actual_revision": exc.actual_revision,
            },
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc

    return {
        "workspace_id": workspace_id,
        "key": key,
        "deleted": True,
        "revision": revision,
    }
