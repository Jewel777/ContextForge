from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

from conflict_audit import ConflictAuditStore
from guardrail_policy_audit import GuardrailPolicyAuditStore
from guardrail_policy_override import GuardrailPolicyOverrideStore


@dataclass(frozen=True)
class GuardrailPolicy:
    workspace_id: str
    key: str
    generated_at: str
    warning_threshold: int
    refresh_threshold: int
    critical_threshold: int
    backoff_scale: float
    sample_size: int
    local_resolution_ratio: float
    unresolved_ratio: float
    average_revision_gap: float
    max_revision_gap: int
    tuning_reason: list[dict[str, Any]]


class GuardrailPolicyService:
    HARD_WARNING_MIN = 20
    HARD_WARNING_MAX = 45
    HARD_REFRESH_MIN = 45
    HARD_REFRESH_MAX = 70
    HARD_CRITICAL_MIN = 70
    HARD_CRITICAL_MAX = 90
    HARD_BACKOFF_MIN = 0.75
    HARD_BACKOFF_MAX = 1.75

    def __init__(self, audit_store: ConflictAuditStore) -> None:
        self._audit_store = audit_store
        self._audit = GuardrailPolicyAuditStore(
            audit_store._settings,
            audit_store._workspace_store,
        )
        self._override = GuardrailPolicyOverrideStore(
            audit_store._settings,
            audit_store._workspace_store,
        )

    def policy(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
        limit: int = 200,
    ) -> GuardrailPolicy:
        records = self._audit_store.list_recent(
            principal_id=principal_id,
            workspace_id=workspace_id,
            limit=max(1, min(limit, 200)),
        )

        key_records = [record for record in records if record.key == key]
        sample = key_records if key_records else records
        sample_size = len(sample)

        resolved = [
            record
            for record in sample
            if record.resolution in {"cloud", "local"}
        ]
        local_count = sum(
            1 for record in resolved if record.resolution == "local"
        )
        local_ratio = (
            local_count / len(resolved)
            if resolved
            else 0.0
        )

        unresolved_count = sum(
            1 for record in sample if record.resolution is None
        )
        unresolved_ratio = (
            unresolved_count / sample_size
            if sample_size
            else 0.0
        )

        gaps = [
            max(
                0,
                record.actual_revision - record.expected_revision,
            )
            for record in sample
        ]
        average_gap = (
            sum(gaps) / len(gaps)
            if gaps
            else 0.0
        )
        max_gap = max(gaps) if gaps else 0

        warning = 30
        refresh = 55
        critical = 75
        backoff_scale = 1.0
        reasons: list[dict[str, Any]] = []

        if sample_size >= 5:
            if unresolved_ratio >= 0.30:
                warning -= 4
                refresh -= 5
                backoff_scale += 0.15
                reasons.append(
                    {
                        "code": "unresolved_pressure",
                        "effect": "more_conservative",
                        "value": round(unresolved_ratio, 3),
                    }
                )

            if average_gap >= 2.0:
                warning -= 4
                refresh -= 6
                critical -= 3
                backoff_scale += 0.20
                reasons.append(
                    {
                        "code": "revision_gap_pressure",
                        "effect": "more_conservative",
                        "value": round(average_gap, 2),
                    }
                )

            if local_ratio >= 0.70:
                warning -= 3
                refresh -= 4
                backoff_scale += 0.10
                reasons.append(
                    {
                        "code": "local_reapply_pressure",
                        "effect": "more_conservative",
                        "value": round(local_ratio, 3),
                    }
                )

            if unresolved_ratio <= 0.05 and average_gap < 1.0:
                warning += 3
                refresh += 4
                critical += 2
                backoff_scale -= 0.10
                reasons.append(
                    {
                        "code": "stable_history",
                        "effect": "less_sensitive",
                        "value": sample_size,
                    }
                )

        warning = max(
            self.HARD_WARNING_MIN,
            min(self.HARD_WARNING_MAX, warning),
        )
        refresh = max(
            self.HARD_REFRESH_MIN,
            min(self.HARD_REFRESH_MAX, refresh),
        )
        critical = max(
            self.HARD_CRITICAL_MIN,
            min(self.HARD_CRITICAL_MAX, critical),
        )

        refresh = max(refresh, warning + 10)
        critical = max(critical, refresh + 10)

        backoff_scale = max(
            self.HARD_BACKOFF_MIN,
            min(self.HARD_BACKOFF_MAX, backoff_scale),
        )

        if not reasons:
            reasons.append(
                {
                    "code": "default_policy",
                    "effect": "unchanged",
                    "value": sample_size,
                }
            )

        result = GuardrailPolicy(
            workspace_id=workspace_id,
            key=key,
            generated_at=datetime.now(timezone.utc).isoformat(),
            warning_threshold=warning,
            refresh_threshold=refresh,
            critical_threshold=critical,
            backoff_scale=round(backoff_scale, 2),
            sample_size=sample_size,
            local_resolution_ratio=round(local_ratio, 4),
            unresolved_ratio=round(unresolved_ratio, 4),
            average_revision_gap=round(average_gap, 2),
            max_revision_gap=max_gap,
            tuning_reason=reasons,
        )


        override = self._override.get_active(
            principal_id=principal_id,
            workspace_id=workspace_id,
            key=key,
        )

        if override is not None:
            result = GuardrailPolicy(
                workspace_id=result.workspace_id,
                key=result.key,
                generated_at=result.generated_at,
                warning_threshold=override.warning_threshold,
                refresh_threshold=override.refresh_threshold,
                critical_threshold=override.critical_threshold,
                backoff_scale=override.backoff_scale,
                sample_size=result.sample_size,
                local_resolution_ratio=result.local_resolution_ratio,
                unresolved_ratio=result.unresolved_ratio,
                average_revision_gap=result.average_revision_gap,
                max_revision_gap=result.max_revision_gap,
                tuning_reason=[
                    *result.tuning_reason,
                    {
                        "code": "pinned_override",
                        "effect": override.source,
                        "value": override.id,
                    },
                ],
            )

        self._audit.record_if_changed(
            principal_id=principal_id,
            workspace_id=workspace_id,
            key=key,
            policy=asdict(result),
        )

        return result
