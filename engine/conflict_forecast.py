from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from conflict_analytics import ConflictAnalyticsService
from conflict_anomaly import ConflictAnomalyService
from conflict_audit import ConflictAuditStore
from guardrail_policy import GuardrailPolicyService


@dataclass(frozen=True)
class ConflictForecast:
    workspace_id: str
    key: str
    action: str
    generated_at: str
    risk_score: int
    risk_level: str
    warning: bool
    require_refresh: bool
    recommended_backoff_ms: int
    recent_key_conflicts_24h: int
    key_conflict_share: float
    max_recent_revision_gap: int
    workspace_anomaly_score: int
    reasons: list[dict[str, Any]]
    recommendation: str


class ConflictForecastService:
    def __init__(
        self,
        audit_store: ConflictAuditStore,
        analytics_service: ConflictAnalyticsService,
        anomaly_service: ConflictAnomalyService,
    ) -> None:
        self._audit_store = audit_store
        self._analytics = analytics_service
        self._anomaly = anomaly_service
        self._policy = GuardrailPolicyService(audit_store)

    def forecast(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
        action: str,
        limit: int = 200,
    ) -> ConflictForecast:
        if action not in {"set", "remove"}:
            raise ValueError("Unsupported write action.")

        records = self._audit_store.list_recent(
            principal_id=principal_id,
            workspace_id=workspace_id,
            limit=max(1, min(limit, 200)),
        )
        analytics = self._analytics.snapshot(
            principal_id=principal_id,
            workspace_id=workspace_id,
            limit=limit,
        )
        anomaly = self._anomaly.analyze(
            principal_id=principal_id,
            workspace_id=workspace_id,
            limit=limit,
        )
        policy = self._policy.policy(
            principal_id=principal_id,
            workspace_id=workspace_id,
            key=key,
            limit=limit,
        )


        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(hours=24)

        def parsed(value: str) -> datetime:
            dt = datetime.fromisoformat(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

        key_records = [record for record in records if record.key == key]
        key_24h = [
            record
            for record in key_records
            if parsed(record.detected_at) >= day_ago
        ]

        total = max(1, analytics.total_conflicts)
        key_share = round(len(key_records) / total, 4)
        max_gap = max(
            (
                max(0, record.actual_revision - record.expected_revision)
                for record in key_records
            ),
            default=0,
        )
        unresolved_for_key = sum(
            1 for record in key_records if record.resolution is None
        )
        repeated_stale = sum(
            1
            for record in key_records
            if record.actual_revision > record.expected_revision
        )

        score = 0
        reasons: list[dict[str, Any]] = []

        if len(key_24h) >= 1:
            contribution = min(30, len(key_24h) * 10)
            score += contribution
            reasons.append(
                {
                    "code": "recent_key_conflicts",
                    "contribution": contribution,
                    "value": len(key_24h),
                    "message": "This key has recent cross-device conflicts.",
                }
            )

        if key_share >= 0.35 and len(key_records) >= 2:
            contribution = min(20, int(round(key_share * 30)))
            score += contribution
            reasons.append(
                {
                    "code": "key_contention_share",
                    "contribution": contribution,
                    "value": key_share,
                    "message": "This key represents a large share of workspace conflicts.",
                }
            )

        if repeated_stale >= 2:
            contribution = min(20, 6 + repeated_stale * 4)
            score += contribution
            reasons.append(
                {
                    "code": "repeated_stale_writes",
                    "contribution": contribution,
                    "value": repeated_stale,
                    "message": "This key repeatedly receives writes from stale revisions.",
                }
            )

        if max_gap >= 2:
            contribution = min(20, max_gap * 4)
            score += contribution
            reasons.append(
                {
                    "code": "revision_gap",
                    "contribution": contribution,
                    "value": max_gap,
                    "message": "Recent conflicts show a meaningful revision gap for this key.",
                }
            )

        if unresolved_for_key >= 1:
            contribution = min(15, unresolved_for_key * 5)
            score += contribution
            reasons.append(
                {
                    "code": "unresolved_key_conflicts",
                    "contribution": contribution,
                    "value": unresolved_for_key,
                    "message": "This key still has unresolved conflict history.",
                }
            )

        if anomaly.anomaly_score >= 45:
            contribution = 12 if anomaly.anomaly_score < 70 else 18
            score += contribution
            reasons.append(
                {
                    "code": "workspace_anomaly_pressure",
                    "contribution": contribution,
                    "value": anomaly.anomaly_score,
                    "message": "Workspace-wide conflict anomaly pressure is elevated.",
                }
            )

        if action == "remove" and score >= 30:
            score += 5
            reasons.append(
                {
                    "code": "destructive_action",
                    "contribution": 5,
                    "value": action,
                    "message": "Removal is treated more cautiously when contention is elevated.",
                }
            )

        score = min(100, score)

        if score >= 75:
            risk_level = "critical"
        elif score >= 55:
            risk_level = "high"
        elif score >= 30:
            risk_level = "medium"
        elif score > 0:
            risk_level = "low"
        else:
            risk_level = "minimal"

        warning = score >= policy.warning_threshold
        require_refresh = score >= policy.refresh_threshold

        if score >= policy.critical_threshold:
            base_backoff = 1200
        elif score >= policy.refresh_threshold:
            base_backoff = 600
        elif score >= policy.warning_threshold:
            base_backoff = 250
        else:
            base_backoff = 0

        recommended_backoff_ms = int(
            round(base_backoff * policy.backoff_scale)
        )

        if require_refresh:
            recommendation = (
                "Refresh the latest server revision before writing this key. "
                "The guardrail will do this automatically."
            )
        elif warning:
            recommendation = (
                "Proceed with caution; this key is showing elevated contention."
            )
        else:
            recommendation = (
                "No preventive refresh is required before this write."
            )

        return ConflictForecast(
            workspace_id=workspace_id,
            key=key,
            action=action,
            generated_at=now.isoformat(),
            risk_score=score,
            risk_level=risk_level,
            warning=warning,
            require_refresh=require_refresh,
            recommended_backoff_ms=recommended_backoff_ms,
            recent_key_conflicts_24h=len(key_24h),
            key_conflict_share=key_share,
            max_recent_revision_gap=max_gap,
            workspace_anomaly_score=anomaly.anomaly_score,
            reasons=reasons,
            recommendation=recommendation,
        )
