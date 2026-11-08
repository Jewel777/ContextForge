from __future__ import annotations

import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from persistence import PersistenceSettings, WorkspacePersistence


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class GuardrailPolicyOverride:
    id: str
    workspace_id: str
    principal_id: str
    key: str
    warning_threshold: int
    refresh_threshold: int
    critical_threshold: int
    backoff_scale: float
    source: str
    source_audit_id: str | None
    reason: str
    active: bool
    created_at: str
    cleared_at: str | None


class GuardrailPolicyOverrideStore:
    HARD_WARNING_MIN = 20
    HARD_WARNING_MAX = 45
    HARD_REFRESH_MIN = 45
    HARD_REFRESH_MAX = 70
    HARD_CRITICAL_MIN = 70
    HARD_CRITICAL_MAX = 90
    HARD_BACKOFF_MIN = 0.75
    HARD_BACKOFF_MAX = 1.75

    def __init__(
        self,
        settings: PersistenceSettings,
        workspace_store: WorkspacePersistence,
    ) -> None:
        self._settings = settings
        self._workspace_store = workspace_store
        self._ensure_schema()

    def _connection(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self._settings.database_path,
            timeout=15,
            check_same_thread=False,
        )
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _ensure_schema(self) -> None:
        if not self._settings.enabled:
            return

        with self._connection() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS guardrail_policy_override (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    principal_id TEXT NOT NULL,
                    key TEXT NOT NULL,
                    warning_threshold INTEGER NOT NULL,
                    refresh_threshold INTEGER NOT NULL,
                    critical_threshold INTEGER NOT NULL,
                    backoff_scale REAL NOT NULL,
                    source TEXT NOT NULL,
                    source_audit_id TEXT,
                    reason TEXT NOT NULL,
                    active INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    cleared_at TEXT,
                    FOREIGN KEY(workspace_id)
                        REFERENCES workspaces(id)
                        ON DELETE CASCADE
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_guardrail_policy_override_workspace_key_active
                ON guardrail_policy_override (
                    workspace_id,
                    key,
                    active,
                    created_at DESC
                )
                """
            )

    @classmethod
    def clamp_values(
        cls,
        *,
        warning_threshold: int,
        refresh_threshold: int,
        critical_threshold: int,
        backoff_scale: float,
    ) -> tuple[int, int, int, float]:
        warning = max(
            cls.HARD_WARNING_MIN,
            min(cls.HARD_WARNING_MAX, int(warning_threshold)),
        )
        refresh = max(
            cls.HARD_REFRESH_MIN,
            min(cls.HARD_REFRESH_MAX, int(refresh_threshold)),
        )
        critical = max(
            cls.HARD_CRITICAL_MIN,
            min(cls.HARD_CRITICAL_MAX, int(critical_threshold)),
        )
        refresh = max(refresh, warning + 10)
        critical = max(critical, refresh + 10)
        critical = min(cls.HARD_CRITICAL_MAX, critical)
        backoff = max(
            cls.HARD_BACKOFF_MIN,
            min(cls.HARD_BACKOFF_MAX, float(backoff_scale)),
        )
        return warning, refresh, critical, round(backoff, 2)

    def get_active(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
    ) -> GuardrailPolicyOverride | None:
        if not self._settings.enabled:
            return None

        self._workspace_store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        with self._connection() as connection:
            row = connection.execute(
                """
                SELECT
                    id,
                    workspace_id,
                    principal_id,
                    key,
                    warning_threshold,
                    refresh_threshold,
                    critical_threshold,
                    backoff_scale,
                    source,
                    source_audit_id,
                    reason,
                    active,
                    created_at,
                    cleared_at
                FROM guardrail_policy_override
                WHERE workspace_id = ?
                  AND key = ?
                  AND active = 1
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (workspace_id, key),
            ).fetchone()

        if row is None:
            return None

        return GuardrailPolicyOverride(
            id=row[0],
            workspace_id=row[1],
            principal_id=row[2],
            key=row[3],
            warning_threshold=int(row[4]),
            refresh_threshold=int(row[5]),
            critical_threshold=int(row[6]),
            backoff_scale=float(row[7]),
            source=row[8],
            source_audit_id=row[9],
            reason=row[10],
            active=bool(row[11]),
            created_at=row[12],
            cleared_at=row[13],
        )

    def set_override(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
        warning_threshold: int,
        refresh_threshold: int,
        critical_threshold: int,
        backoff_scale: float,
        source: str,
        source_audit_id: str | None,
        reason: str,
    ) -> GuardrailPolicyOverride:
        self._workspace_store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        if source not in {"manual", "rollback"}:
            raise ValueError("Unsupported override source.")

        warning, refresh, critical, backoff = self.clamp_values(
            warning_threshold=warning_threshold,
            refresh_threshold=refresh_threshold,
            critical_threshold=critical_threshold,
            backoff_scale=backoff_scale,
        )

        record_id = str(uuid.uuid4())
        created_at = _utc_now()

        with self._connection() as connection:
            connection.execute(
                """
                UPDATE guardrail_policy_override
                SET active = 0, cleared_at = ?
                WHERE workspace_id = ?
                  AND key = ?
                  AND active = 1
                """,
                (created_at, workspace_id, key),
            )
            connection.execute(
                """
                INSERT INTO guardrail_policy_override (
                    id,
                    workspace_id,
                    principal_id,
                    key,
                    warning_threshold,
                    refresh_threshold,
                    critical_threshold,
                    backoff_scale,
                    source,
                    source_audit_id,
                    reason,
                    active,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    record_id,
                    workspace_id,
                    principal_id,
                    key,
                    warning,
                    refresh,
                    critical,
                    backoff,
                    source,
                    source_audit_id,
                    reason.strip()[:500] or "No reason supplied.",
                    created_at,
                ),
            )

        return GuardrailPolicyOverride(
            id=record_id,
            workspace_id=workspace_id,
            principal_id=principal_id,
            key=key,
            warning_threshold=warning,
            refresh_threshold=refresh,
            critical_threshold=critical,
            backoff_scale=backoff,
            source=source,
            source_audit_id=source_audit_id,
            reason=reason.strip()[:500] or "No reason supplied.",
            active=True,
            created_at=created_at,
            cleared_at=None,
        )

    def clear_override(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
    ) -> bool:
        self._workspace_store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        cleared_at = _utc_now()

        with self._connection() as connection:
            cursor = connection.execute(
                """
                UPDATE guardrail_policy_override
                SET active = 0, cleared_at = ?
                WHERE workspace_id = ?
                  AND key = ?
                  AND active = 1
                """,
                (cleared_at, workspace_id, key),
            )

        return cursor.rowcount > 0
