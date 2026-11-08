from __future__ import annotations

from datetime import datetime, timezone

import json

from persistence import WorkspacePersistence



def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

class WorkspaceConflictError(RuntimeError):
    def __init__(
        self,
        *,
        workspace_id: str,
        key: str,
        expected_revision: int,
        actual_revision: int,
    ) -> None:
        super().__init__(
            f"Workspace state conflict for {workspace_id}/{key}: "
            f"expected revision {expected_revision}, actual revision {actual_revision}."
        )
        self.workspace_id = workspace_id
        self.key = key
        self.expected_revision = expected_revision
        self.actual_revision = actual_revision


class ConcurrentWorkspacePersistence:
    def __init__(self, store: WorkspacePersistence) -> None:
        self._store = store
        self._ensure_revision_column()

    def _ensure_revision_column(self) -> None:
        if not self._store.settings.enabled:
            return

        with self._store._connect() as connection:
            columns = {
                row[1]
                for row in connection.execute(
                    "PRAGMA table_info(workspace_kv)"
                ).fetchall()
            }

            if "revision" not in columns:
                connection.execute(
                    "ALTER TABLE workspace_kv "
                    "ADD COLUMN revision INTEGER NOT NULL DEFAULT 1"
                )

    def get_record(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
    ):
        self._store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        with self._store._connect() as connection:
            row = connection.execute(
                "SELECT value_json, revision, updated_at "
                "FROM workspace_kv "
                "WHERE workspace_id = ? AND key = ?",
                (workspace_id, key),
            ).fetchone()

        if row is None:
            return None

        return {
            "value": json.loads(row[0]),
            "revision": int(row[1]),
            "updated_at": row[2],
        }

    def put(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
        value,
        expected_revision: int,
    ) -> int:
        self._store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        value_json = json.dumps(
            value,
            separators=(",", ":"),
            ensure_ascii=False,
        )
        updated_at = _utc_now()

        with self._store._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")

            row = connection.execute(
                "SELECT revision "
                "FROM workspace_kv "
                "WHERE workspace_id = ? AND key = ?",
                (workspace_id, key),
            ).fetchone()

            actual_revision = 0 if row is None else int(row[0])

            if expected_revision != actual_revision:
                raise WorkspaceConflictError(
                    workspace_id=workspace_id,
                    key=key,
                    expected_revision=expected_revision,
                    actual_revision=actual_revision,
                )

            next_revision = actual_revision + 1

            connection.execute(
                "INSERT INTO workspace_kv "
                "(workspace_id, key, value_json, revision, updated_at) "
                "VALUES (?, ?, ?, ?, ?) "
                "ON CONFLICT(workspace_id, key) DO UPDATE SET "
                "value_json = excluded.value_json, "
                "revision = excluded.revision, "
                "updated_at = excluded.updated_at",
                (
                    workspace_id,
                    key,
                    value_json,
                    next_revision,
                    updated_at,
                ),
            )

            connection.execute(
                "INSERT INTO workspace_audit "
                "(workspace_id, principal_id, action, key, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    workspace_id,
                    principal_id,
                    "put",
                    key,
                    updated_at,
                ),
            )

        return next_revision

    def delete(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
        expected_revision: int,
    ) -> int:
        self._store._assert_owner(
            principal_id=principal_id,
            workspace_id=workspace_id,
        )

        with self._store._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")

            row = connection.execute(
                "SELECT revision "
                "FROM workspace_kv "
                "WHERE workspace_id = ? AND key = ?",
                (workspace_id, key),
            ).fetchone()

            actual_revision = 0 if row is None else int(row[0])

            if expected_revision != actual_revision:
                raise WorkspaceConflictError(
                    workspace_id=workspace_id,
                    key=key,
                    expected_revision=expected_revision,
                    actual_revision=actual_revision,
                )

            connection.execute(
                "DELETE FROM workspace_kv "
                "WHERE workspace_id = ? AND key = ?",
                (workspace_id, key),
            )

            connection.execute(
                "INSERT INTO workspace_audit "
                "(workspace_id, principal_id, action, key, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    workspace_id,
                    principal_id,
                    "delete",
                    key,
                    _utc_now(),
                ),
            )

        return actual_revision + 1
