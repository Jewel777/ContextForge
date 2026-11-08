from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from conflict_audit import ConflictAuditStore


@dataclass(frozen=True)
class ConflictAnalyticsSnapshot:
    workspace_id: str
    generated_at: str
    total_conflicts: int
    conflicts_24h: int
    conflicts_7d: int
    unresolved_conflicts: int
    cloud_resolutions: int
    local_resolutions: int
    resolution_cloud_ratio: float
    average_revision_gap: float
    max_revision_gap: int
    hot_keys: list[dict[str, Any]]
    repeated_stale_keys: list[dict[str, Any]]
    trend_daily: list[dict[str, Any]]
    health_score: int
    health_level: str


class ConflictAnalyticsService:
    def __init__(self, audit_store: ConflictAuditStore) -> None:
        self._audit_store = audit_store

    def snapshot(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        limit: int = 200,
    ) -> ConflictAnalyticsSnapshot:
        records = self._audit_store.list_recent(
            principal_id=principal_id,
            workspace_id=workspace_id,
            limit=max(1, min(limit, 200)),
        )

        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(hours=24)
        week_ago = now - timedelta(days=7)

        def parsed(value: str) -> datetime:
            dt = datetime.fromisoformat(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

        total = len(records)
        conflicts_24h = sum(
            1 for record in records if parsed(record.detected_at) >= day_ago
        )
        conflicts_7d = sum(
            1 for record in records if parsed(record.detected_at) >= week_ago
        )
        unresolved = sum(1 for record in records if record.resolution is None)
        cloud = sum(1 for record in records if record.resolution == "cloud")
        local = sum(1 for record in records if record.resolution == "local")
        resolved = cloud + local
        cloud_ratio = round(cloud / resolved, 4) if resolved else 0.0

        gaps = [
            max(0, record.actual_revision - record.expected_revision)
            for record in records
        ]
        average_gap = round(sum(gaps) / len(gaps), 2) if gaps else 0.0
        max_gap = max(gaps) if gaps else 0

        key_counts = Counter(record.key for record in records)
        hot_keys = [
            {"key": key, "count": count}
            for key, count in key_counts.most_common(5)
        ]

        stale_counts = Counter(
            record.key
            for record in records
            if record.actual_revision > record.expected_revision
        )
        repeated_stale_keys = [
            {"key": key, "count": count}
            for key, count in stale_counts.most_common(5)
            if count >= 2
        ]

        daily_counts: Counter[str] = Counter()
        for record in records:
            dt = parsed(record.detected_at)
            if dt >= week_ago:
                daily_counts[dt.date().isoformat()] += 1

        trend_daily: list[dict[str, Any]] = []
        for offset in range(6, -1, -1):
            day = (now - timedelta(days=offset)).date().isoformat()
            trend_daily.append(
                {
                    "date": day,
                    "count": daily_counts.get(day, 0),
                }
            )

        penalty = 0
        penalty += min(30, conflicts_24h * 5)
        penalty += min(25, unresolved * 8)
        penalty += min(20, len(repeated_stale_keys) * 5)
        penalty += min(15, max_gap * 3)
        penalty += min(10, max(0, conflicts_7d - 5))
        health_score = max(0, 100 - penalty)

        if health_score >= 85:
            health_level = "healthy"
        elif health_score >= 65:
            health_level = "watch"
        else:
            health_level = "degraded"

        return ConflictAnalyticsSnapshot(
            workspace_id=workspace_id,
            generated_at=now.isoformat(),
            total_conflicts=total,
            conflicts_24h=conflicts_24h,
            conflicts_7d=conflicts_7d,
            unresolved_conflicts=unresolved,
            cloud_resolutions=cloud,
            local_resolutions=local,
            resolution_cloud_ratio=cloud_ratio,
            average_revision_gap=average_gap,
            max_revision_gap=max_gap,
            hot_keys=hot_keys,
            repeated_stale_keys=repeated_stale_keys,
            trend_daily=trend_daily,
            health_score=health_score,
            health_level=health_level,
        )
