from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from persistence import PersistenceSettings, WorkspacePersistence


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class ConflictAuditRecord:
    id: str
    workspace_id: str
    principal_id: str
    key: str
    expected_revision: int
    actual_revision: int
    local_action: str
    resolution: str | None
    detected_at: str
    resolved_at: str | None


class ConflictAuditStore:
    def __init__(
        self,
        settings: PersistenceSettings,
        workspace_store: WorkspacePersistence,
    ) -> None:
        self._settings = settings
        self._workspace_store = workspace_store
        self._ensure_schema()

    def _connection(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._settings.database_path)
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _ensure_schema(self) -> None:
        if not self._settings.enabled:
            return

        with self._connection() as connection:
            connection.execute(
                '''
                CREATE TABLE IF NOT EXISTS workspace_conflict_audit (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    principal_id TEXT NOT NULL,
                    key TEXT NOT NULL,
                    expected_revision INTEGER NOT NULL,
                    actual_revision INTEGER NOT NULL,
                    local_action TEXT NOT NULL,
                    resolution TEXT,
                    detected_at TEXT NOT NULL,
                    resolved_at TEXT,
                    FOREIGN KEY(workspace_id)
                        REFERENCES workspaces(id)
                        ON DELETE CASCADE
                )
                '''
            )
            connection.execute(
                '''
                CREATE INDEX IF NOT EXISTS
                    idx_workspace_conflict_audit_workspace_detected
                ON workspace_conflict_audit (
                    workspace_id,
                    detected_at DESC
                )
                '''
            )

    def record_detected(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
        expected_revision: int,
        actual_revision: int,
        local_action: str,
    ) -> ConflictAuditRecord:
        self._workspace_store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        if local_action not in {"set", "remove"}:
            raise ValueError("Unsupported local conflict action.")

        conflict_id = str(uuid.uuid4())
        detected_at = _utc_now()

        with self._connection() as connection:
            connection.execute(
                '''
                INSERT INTO workspace_conflict_audit (
                    id,
                    workspace_id,
                    principal_id,
                    key,
                    expected_revision,
                    actual_revision,
                    local_action,
                    detected_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    conflict_id,
                    workspace_id,
                    principal_id,
                    key,
                    expected_revision,
                    actual_revision,
                    local_action,
                    detected_at,
                ),
            )

        return ConflictAuditRecord(
            id=conflict_id,
            workspace_id=workspace_id,
            principal_id=principal_id,
            key=key,
            expected_revision=expected_revision,
            actual_revision=actual_revision,
            local_action=local_action,
            resolution=None,
            detected_at=detected_at,
            resolved_at=None,
        )

    def resolve(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        conflict_id: str,
        resolution: str,
    ) -> ConflictAuditRecord:
        self._workspace_store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        if resolution not in {"cloud", "local"}:
            raise ValueError("Unsupported conflict resolution.")

        resolved_at = _utc_now()

        with self._connection() as connection:
            row = connection.execute(
                '''
                SELECT
                    id,
                    workspace_id,
                    principal_id,
                    key,
                    expected_revision,
                    actual_revision,
                    local_action,
                    resolution,
                    detected_at,
                    resolved_at
                FROM workspace_conflict_audit
                WHERE id = ? AND workspace_id = ?
                ''',
                (conflict_id, workspace_id),
            ).fetchone()

            if row is None:
                raise KeyError("Conflict audit record not found.")

            connection.execute(
                '''
                UPDATE workspace_conflict_audit
                SET resolution = ?, resolved_at = ?
                WHERE id = ? AND workspace_id = ?
                ''',
                (
                    resolution,
                    resolved_at,
                    conflict_id,
                    workspace_id,
                ),
            )

        return ConflictAuditRecord(
            id=row[0],
            workspace_id=row[1],
            principal_id=row[2],
            key=row[3],
            expected_revision=int(row[4]),
            actual_revision=int(row[5]),
            local_action=row[6],
            resolution=resolution,
            detected_at=row[8],
            resolved_at=resolved_at,
        )

    def list_recent(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        limit: int = 50,
    ) -> list[ConflictAuditRecord]:
        self._workspace_store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        safe_limit = max(1, min(int(limit), 200))

        with self._connection() as connection:
            rows = connection.execute(
                '''
                SELECT
                    id,
                    workspace_id,
                    principal_id,
                    key,
                    expected_revision,
                    actual_revision,
                    local_action,
                    resolution,
                    detected_at,
                    resolved_at
                FROM workspace_conflict_audit
                WHERE workspace_id = ?
                ORDER BY detected_at DESC
                LIMIT ?
                ''',
                (workspace_id, safe_limit),
            ).fetchall()

        return [
            ConflictAuditRecord(
                id=row[0],
                workspace_id=row[1],
                principal_id=row[2],
                key=row[3],
                expected_revision=int(row[4]),
                actual_revision=int(row[5]),
                local_action=row[6],
                resolution=row[7],
                detected_at=row[8],
                resolved_at=row[9],
            )
            for row in rows
        ]
