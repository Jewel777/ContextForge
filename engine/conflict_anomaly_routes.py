from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Header, HTTPException, Query

from auth_contract import AuthenticationUnavailable, resolve_principal
from conflict_analytics import ConflictAnalyticsService
from conflict_anomaly import ConflictAnomalyService
from conflict_audit import ConflictAuditStore
from persistence import PersistenceSettings, WorkspacePersistence

router = APIRouter()
_settings = PersistenceSettings.from_env()
_workspace_store = WorkspacePersistence(_settings)
_audit_store = ConflictAuditStore(_settings, _workspace_store)
_analytics_service = ConflictAnalyticsService(_audit_store)
_service = ConflictAnomalyService(_audit_store, _analytics_service)


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


@router.get("/workspace-conflicts/anomalies")
def conflict_anomalies(
    workspace_id: str = Query(..., min_length=1, max_length=160),
    limit: int = Query(default=200, ge=1, le=200),
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
        snapshot = _service.analyze(
            principal_id=principal.id,
            workspace_id=workspace_id,
            limit=limit,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return asdict(snapshot)
