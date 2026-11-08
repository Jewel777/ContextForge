from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from conflict_analytics import ConflictAnalyticsService
from conflict_audit import ConflictAuditStore


@dataclass(frozen=True)
class ConflictAnomalySnapshot:
    workspace_id: str
    generated_at: str
    anomaly_score: int
    severity: str
    detected: bool
    summary: str
    signals: list[dict[str, Any]]
    root_causes: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]


class ConflictAnomalyService:
    def __init__(
        self,
        audit_store: ConflictAuditStore,
        analytics_service: ConflictAnalyticsService,
    ) -> None:
        self._audit_store = audit_store
        self._analytics = analytics_service

    def analyze(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        limit: int = 200,
    ) -> ConflictAnomalySnapshot:
        analytics = self._analytics.snapshot(
            principal_id=principal_id,
            workspace_id=workspace_id,
            limit=limit,
        )
        records = self._audit_store.list_recent(
            principal_id=principal_id,
            workspace_id=workspace_id,
            limit=max(1, min(limit, 200)),
        )

        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        previous_six_days_start = now - timedelta(days=7)
        previous_six_days_end = now - timedelta(days=1)

        def parsed(value: str) -> datetime:
            dt = datetime.fromisoformat(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

        previous_window = [
            record
            for record in records
            if previous_six_days_start <= parsed(record.detected_at) < previous_six_days_end
        ]
        baseline_daily = len(previous_window) / 6.0 if previous_window else 0.0

        signals: list[dict[str, Any]] = []
        root_causes: list[dict[str, Any]] = []
        recommendations: list[dict[str, Any]] = []
        score = 0

        spike_threshold = max(3.0, baseline_daily * 2.5)
        if analytics.conflicts_24h >= spike_threshold:
            weight = min(30, 12 + analytics.conflicts_24h * 3)
            score += weight
            signals.append(
                {
                    "code": "conflict_spike",
                    "severity": "high" if analytics.conflicts_24h >= 6 else "medium",
                    "weight": weight,
                    "observed": analytics.conflicts_24h,
                    "baseline_daily": round(baseline_daily, 2),
                    "message": (
                        "Conflict frequency in the last 24 hours is materially above "
                        "the recent daily baseline."
                    ),
                }
            )
            root_causes.append(
                {
                    "code": "concurrent_session_pressure",
                    "confidence": 0.82,
                    "message": (
                        "Multiple active or stale sessions are likely writing the same "
                        "workspace state at overlapping times."
                    ),
                }
            )
            recommendations.append(
                {
                    "code": "refresh_stale_sessions",
                    "priority": "high",
                    "action": (
                        "Refresh long-lived sessions and verify that clients re-read the "
                        "latest revision before attempting another write."
                    ),
                }
            )

        if analytics.unresolved_conflicts >= 3:
            weight = min(25, 8 + analytics.unresolved_conflicts * 4)
            score += weight
            signals.append(
                {
                    "code": "resolution_backlog",
                    "severity": "high" if analytics.unresolved_conflicts >= 6 else "medium",
                    "weight": weight,
                    "observed": analytics.unresolved_conflicts,
                    "message": "The workspace has an accumulating unresolved conflict backlog.",
                }
            )
            root_causes.append(
                {
                    "code": "recovery_backlog",
                    "confidence": 0.9,
                    "message": (
                        "Detected conflicts are not being resolved quickly enough to keep "
                        "the workspace state converged."
                    ),
                }
            )
            recommendations.append(
                {
                    "code": "clear_resolution_backlog",
                    "priority": "high",
                    "action": (
                        "Review unresolved conflict records, resolve the oldest first, and "
                        "confirm the chosen version before resuming bulk edits."
                    ),
                }
            )

        if analytics.max_revision_gap >= 3:
            weight = min(20, analytics.max_revision_gap * 4)
            score += weight
            signals.append(
                {
                    "code": "large_revision_gap",
                    "severity": "high" if analytics.max_revision_gap >= 5 else "medium",
                    "weight": weight,
                    "observed": analytics.max_revision_gap,
                    "message": (
                        "At least one stale client is several revisions behind the current "
                        "server state."
                    ),
                }
            )
            root_causes.append(
                {
                    "code": "long_lived_stale_client",
                    "confidence": 0.88,
                    "message": (
                        "A long-lived browser session or delayed sync path is likely "
                        "operating on outdated revisions."
                    ),
                }
            )
            recommendations.append(
                {
                    "code": "force_revision_refresh",
                    "priority": "high",
                    "action": (
                        "Force a server revision refresh before retrying writes from clients "
                        "with revision gaps of three or more."
                    ),
                }
            )

        if analytics.repeated_stale_keys:
            top = analytics.repeated_stale_keys[0]
            weight = min(20, 6 + int(top["count"]) * 3)
            score += weight
            signals.append(
                {
                    "code": "repeated_hot_key",
                    "severity": "medium",
                    "weight": weight,
                    "key": top["key"],
                    "observed": top["count"],
                    "message": "The same durable key is repeatedly involved in stale writes.",
                }
            )
            root_causes.append(
                {
                    "code": "high_contention_key",
                    "confidence": 0.93,
                    "key": top["key"],
                    "message": (
                        "A single durable state key is acting as a contention hot spot "
                        "across sessions."
                    ),
                }
            )
            recommendations.append(
                {
                    "code": "reduce_hot_key_contention",
                    "priority": "medium",
                    "key": top["key"],
                    "action": (
                        "Reduce write frequency for the hot key or split independent state "
                        "into smaller records so unrelated updates do not compete."
                    ),
                }
            )

        top_hot_count = int(analytics.hot_keys[0]["count"]) if analytics.hot_keys else 0
        concentration = (top_hot_count / analytics.total_conflicts) if analytics.total_conflicts else 0.0
        if analytics.total_conflicts >= 4 and concentration >= 0.5:
            weight = min(15, 8 + round(concentration * 10))
            score += weight
            signals.append(
                {
                    "code": "key_concentration",
                    "severity": "medium",
                    "weight": weight,
                    "ratio": round(concentration, 3),
                    "message": (
                        "A disproportionate share of conflicts is concentrated in one state key."
                    ),
                }
            )
            recommendations.append(
                {
                    "code": "partition_state",
                    "priority": "medium",
                    "action": (
                        "Consider partitioning the dominant state record or batching writes "
                        "so one high-churn key does not serialize unrelated changes."
                    ),
                }
            )

        resolved_total = analytics.cloud_resolutions + analytics.local_resolutions
        local_ratio = (
            analytics.local_resolutions / resolved_total
            if resolved_total
            else 0.0
        )
        if resolved_total >= 5 and local_ratio >= 0.7:
            weight = 10
            score += weight
            signals.append(
                {
                    "code": "local_reapply_skew",
                    "severity": "medium",
                    "weight": weight,
                    "ratio": round(local_ratio, 3),
                    "message": (
                        "Most resolved conflicts are being re-applied from the displaced "
                        "local version instead of accepting cloud state."
                    ),
                }
            )
            root_causes.append(
                {
                    "code": "workflow_contention",
                    "confidence": 0.72,
                    "message": (
                        "Users appear to be intentionally preserving competing local edits, "
                        "which suggests real workflow contention rather than accidental staleness."
                    ),
                }
            )
            recommendations.append(
                {
                    "code": "coordinate_editing",
                    "priority": "medium",
                    "action": (
                        "Coordinate concurrent editing on shared workspace settings or move "
                        "high-contention workflows to finer-grained records."
                    ),
                }
            )

        score = min(100, score)

        if score >= 70:
            severity = "critical"
        elif score >= 45:
            severity = "high"
        elif score >= 20:
            severity = "medium"
        elif score > 0:
            severity = "low"
        else:
            severity = "healthy"

        detected = score > 0

        if not detected:
            summary = (
                "No meaningful conflict anomaly is currently detected for this workspace."
            )
            recommendations.append(
                {
                    "code": "continue_monitoring",
                    "priority": "low",
                    "action": (
                        "Continue monitoring conflict frequency and revision gaps; no "
                        "remediation is currently required."
                    ),
                }
            )
        else:
            summary = (
                f"Conflict anomaly score {score}/100 ({severity}). "
                f"{len(signals)} signal(s) require operational attention."
            )

        return ConflictAnomalySnapshot(
            workspace_id=workspace_id,
            generated_at=now.isoformat(),
            anomaly_score=score,
            severity=severity,
            detected=detected,
            summary=summary,
            signals=signals,
            root_causes=root_causes,
            recommendations=recommendations,
        )
