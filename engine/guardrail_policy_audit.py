from __future__ import annotations

import hashlib
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
class GuardrailPolicyAuditRecord:
    id: str
    workspace_id: str
    principal_id: str
    key: str
    warning_threshold: int
    refresh_threshold: int
    critical_threshold: int
    backoff_scale: float
    sample_size: int
    tuning_reason: list[dict[str, Any]]
    policy_hash: str
    previous_policy_hash: str | None
    changed: bool
    created_at: str


class GuardrailPolicyAuditStore:
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
                """
                CREATE TABLE IF NOT EXISTS guardrail_policy_audit (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    principal_id TEXT NOT NULL,
                    key TEXT NOT NULL,
                    warning_threshold INTEGER NOT NULL,
                    refresh_threshold INTEGER NOT NULL,
                    critical_threshold INTEGER NOT NULL,
                    backoff_scale REAL NOT NULL,
                    sample_size INTEGER NOT NULL,
                    tuning_reason_json TEXT NOT NULL,
                    policy_hash TEXT NOT NULL,
                    previous_policy_hash TEXT,
                    changed INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(workspace_id)
                        REFERENCES workspaces(id)
                        ON DELETE CASCADE
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_guardrail_policy_audit_workspace_key_created
                ON guardrail_policy_audit (
                    workspace_id,
                    key,
                    created_at DESC
                )
                """
            )

    @staticmethod
    def _hash_policy(policy: dict[str, Any]) -> str:
        payload = {
            "warning_threshold": policy["warning_threshold"],
            "refresh_threshold": policy["refresh_threshold"],
            "critical_threshold": policy["critical_threshold"],
            "backoff_scale": policy["backoff_scale"],
            "tuning_reason": policy["tuning_reason"],
        }
        encoded = json.dumps(
            payload,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def record_if_changed(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
        policy: dict[str, Any],
    ) -> GuardrailPolicyAuditRecord | None:
        if not self._settings.enabled:
            return None

        self._workspace_store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        policy_hash = self._hash_policy(policy)

        with self._connection() as connection:
            previous = connection.execute(
                """
                SELECT policy_hash
                FROM guardrail_policy_audit
                WHERE workspace_id = ? AND key = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (workspace_id, key),
            ).fetchone()

            previous_hash = previous[0] if previous else None

            if previous_hash == policy_hash:
                return None

            record_id = str(uuid.uuid4())
            created_at = _utc_now()

            connection.execute(
                """
                INSERT INTO guardrail_policy_audit (
                    id,
                    workspace_id,
                    principal_id,
                    key,
                    warning_threshold,
                    refresh_threshold,
                    critical_threshold,
                    backoff_scale,
                    sample_size,
                    tuning_reason_json,
                    policy_hash,
                    previous_policy_hash,
                    changed,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    workspace_id,
                    principal_id,
                    key,
                    int(policy["warning_threshold"]),
                    int(policy["refresh_threshold"]),
                    int(policy["critical_threshold"]),
                    float(policy["backoff_scale"]),
                    int(policy["sample_size"]),
                    json.dumps(policy["tuning_reason"], sort_keys=True),
                    policy_hash,
                    previous_hash,
                    1 if previous_hash is not None else 0,
                    created_at,
                ),
            )

        return GuardrailPolicyAuditRecord(
            id=record_id,
            workspace_id=workspace_id,
            principal_id=principal_id,
            key=key,
            warning_threshold=int(policy["warning_threshold"]),
            refresh_threshold=int(policy["refresh_threshold"]),
            critical_threshold=int(policy["critical_threshold"]),
            backoff_scale=float(policy["backoff_scale"]),
            sample_size=int(policy["sample_size"]),
            tuning_reason=list(policy["tuning_reason"]),
            policy_hash=policy_hash,
            previous_policy_hash=previous_hash,
            changed=previous_hash is not None,
            created_at=created_at,
        )

    def list_recent(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str | None = None,
        limit: int = 50,
    ) -> list[GuardrailPolicyAuditRecord]:
        self._workspace_store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        safe_limit = max(1, min(int(limit), 200))

        query = """
            SELECT
                id,
                workspace_id,
                principal_id,
                key,
                warning_threshold,
                refresh_threshold,
                critical_threshold,
                backoff_scale,
                sample_size,
                tuning_reason_json,
                policy_hash,
                previous_policy_hash,
                changed,
                created_at
            FROM guardrail_policy_audit
            WHERE workspace_id = ?
        """
        params: list[Any] = [workspace_id]

        if key:
            query += " AND key = ?"
            params.append(key)

        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(safe_limit)

        with self._connection() as connection:
            rows = connection.execute(query, tuple(params)).fetchall()

        return [
            GuardrailPolicyAuditRecord(
                id=row[0],
                workspace_id=row[1],
                principal_id=row[2],
                key=row[3],
                warning_threshold=int(row[4]),
                refresh_threshold=int(row[5]),
                critical_threshold=int(row[6]),
                backoff_scale=float(row[7]),
                sample_size=int(row[8]),
                tuning_reason=json.loads(row[9]),
                policy_hash=row[10],
                previous_policy_hash=row[11],
                changed=bool(row[12]),
                created_at=row[13],
            )
            for row in rows
        ]
