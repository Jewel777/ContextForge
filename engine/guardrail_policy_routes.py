from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from auth_contract import AuthenticationUnavailable, resolve_principal
from conflict_audit import ConflictAuditStore
from guardrail_policy import GuardrailPolicyService
from guardrail_policy_audit import GuardrailPolicyAuditStore
from guardrail_policy_override import GuardrailPolicyOverrideStore
from persistence import PersistenceSettings, WorkspacePersistence



class GuardrailOverridePayload(BaseModel):
    workspace_id: str
    key: str
    warning_threshold: int
    refresh_threshold: int
    critical_threshold: int
    backoff_scale: float
    source: str
    source_audit_id: str | None = None
    reason: str = ""


class GuardrailOverrideClearPayload(BaseModel):
    workspace_id: str
    key: str


router = APIRouter()
_settings = PersistenceSettings.from_env()
_workspace_store = WorkspacePersistence(_settings)
_audit_store = ConflictAuditStore(_settings, _workspace_store)
_service = GuardrailPolicyService(_audit_store)
_policy_audit_store = GuardrailPolicyAuditStore(_settings, _workspace_store)
_override_store = GuardrailPolicyOverrideStore(_settings, _workspace_store)


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


@router.get("/workspace-conflicts/guardrail-policy")
def guardrail_policy(
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
    principal = _principal(principal_id, principal_name)

    try:
        policy = _service.policy(
            principal_id=principal.id,
            workspace_id=workspace_id,
            key=key,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return asdict(policy)


@router.get("/workspace-conflicts/guardrail-policy/history")
def guardrail_policy_history(
    workspace_id: str = Query(..., min_length=1, max_length=160),
    key: str | None = Query(default=None, min_length=1, max_length=240),
    limit: int = Query(default=50, ge=1, le=200),
    principal_id: str | None = Header(default=None, alias="x-contextforge-principal-id"),
    principal_name: str | None = Header(default=None, alias="x-contextforge-principal-name"),
):
    principal = _principal(principal_id, principal_name)

    try:
        records = _policy_audit_store.list_recent(
            principal_id=principal.id,
            workspace_id=workspace_id,
            key=key,
            limit=limit,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return {
        "workspace_id": workspace_id,
        "records": [asdict(record) for record in records],
    }


@router.get("/workspace-conflicts/guardrail-policy/override")
def get_guardrail_override(
    workspace_id: str = Query(..., min_length=1, max_length=160),
    key: str = Query(..., min_length=1, max_length=240),
    principal_id: str | None = Header(default=None, alias="x-contextforge-principal-id"),
    principal_name: str | None = Header(default=None, alias="x-contextforge-principal-name"),
):
    principal = _principal(principal_id, principal_name)
    try:
        record = _override_store.get_active(
            principal_id=principal.id,
            workspace_id=workspace_id,
            key=key,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if record is None:
        raise HTTPException(status_code=404, detail="No active override.")
    return asdict(record)


@router.post("/workspace-conflicts/guardrail-policy/override")
def set_guardrail_override(
    payload: GuardrailOverridePayload,
    principal_id: str | None = Header(default=None, alias="x-contextforge-principal-id"),
    principal_name: str | None = Header(default=None, alias="x-contextforge-principal-name"),
):
    principal = _principal(principal_id, principal_name)
    try:
        record = _override_store.set_override(
            principal_id=principal.id,
            workspace_id=payload.workspace_id,
            key=payload.key,
            warning_threshold=payload.warning_threshold,
            refresh_threshold=payload.refresh_threshold,
            critical_threshold=payload.critical_threshold,
            backoff_scale=payload.backoff_scale,
            source=payload.source,
            source_audit_id=payload.source_audit_id,
            reason=payload.reason,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return asdict(record)


@router.delete("/workspace-conflicts/guardrail-policy/override")
def clear_guardrail_override(
    payload: GuardrailOverrideClearPayload,
    principal_id: str | None = Header(default=None, alias="x-contextforge-principal-id"),
    principal_name: str | None = Header(default=None, alias="x-contextforge-principal-name"),
):
    principal = _principal(principal_id, principal_name)
    try:
        cleared = _override_store.clear_override(
            principal_id=principal.id,
            workspace_id=payload.workspace_id,
            key=payload.key,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return {"cleared": cleared}
