from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PersistenceSettings:
    enabled: bool
    database_path: Path

    @classmethod
    def from_env(cls) -> "PersistenceSettings":
        enabled = os.getenv(
            "CONTEXTFORGE_SERVER_PERSISTENCE_ENABLED",
            "false",
        ).strip().lower() in {"1", "true", "yes", "on"}

        raw_path = os.getenv(
            "CONTEXTFORGE_SERVER_PERSISTENCE_DB",
            "data/contextforge.db",
        ).strip()

        path = Path(raw_path)
        if not path.is_absolute():
            path = Path(__file__).resolve().parent / path

        return cls(enabled=enabled, database_path=path)


class WorkspacePersistence:
    def __init__(self, settings: PersistenceSettings) -> None:
        self.settings = settings
        self._lock = threading.RLock()

        if settings.enabled:
            settings.database_path.parent.mkdir(parents=True, exist_ok=True)
            self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self.settings.database_path,
            timeout=15,
            check_same_thread=False,
        )
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _initialize(self) -> None:
        schema = """
        CREATE TABLE IF NOT EXISTS principals (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            owner_principal_id TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(owner_principal_id) REFERENCES principals(id)
        );

        CREATE INDEX IF NOT EXISTS idx_workspaces_owner
            ON workspaces(owner_principal_id);

        CREATE TABLE IF NOT EXISTS workspace_kv (
            workspace_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value_json TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(workspace_id, key),
            FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_workspace_kv_workspace
            ON workspace_kv(workspace_id);

        CREATE TABLE IF NOT EXISTS workspace_audit (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            principal_id TEXT NOT NULL,
            action TEXT NOT NULL,
            key TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
                ON DELETE CASCADE,
            FOREIGN KEY(principal_id) REFERENCES principals(id)
        );

        CREATE INDEX IF NOT EXISTS idx_workspace_audit_workspace_created
            ON workspace_audit(workspace_id, created_at DESC);
        """

        with self._lock, self._connect() as connection:
            connection.executescript(schema)

    def ensure_principal(self, principal_id: str, display_name: str) -> None:
        if not self.settings.enabled:
            return

        now = int(time.time())
        sql = """
        INSERT INTO principals (id, display_name, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name
        """

        with self._lock, self._connect() as connection:
            connection.execute(sql, (principal_id, display_name, now))

    def ensure_workspace(
        self,
        *,
        workspace_id: str,
        owner_principal_id: str,
        display_name: str,
    ) -> None:
        if not self.settings.enabled:
            return

        now = int(time.time())
        lookup_sql = (
            "SELECT owner_principal_id FROM workspaces WHERE id = ?"
        )
        upsert_sql = """
        INSERT INTO workspaces (
            id,
            owner_principal_id,
            display_name,
            created_at
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name
        """

        with self._lock, self._connect() as connection:
            row = connection.execute(
                lookup_sql,
                (workspace_id,),
            ).fetchone()

            if row is not None and row["owner_principal_id"] != owner_principal_id:
                raise PermissionError("Workspace owner mismatch.")

            connection.execute(
                upsert_sql,
                (
                    workspace_id,
                    owner_principal_id,
                    display_name,
                    now,
                ),
            )

    def put(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
        value: Any,
    ) -> None:
        if not self.settings.enabled:
            raise RuntimeError("Server persistence is disabled.")

        now = int(time.time())
        encoded = json.dumps(
            value,
            separators=(",", ":"),
            ensure_ascii=False,
        )

        upsert_sql = """
        INSERT INTO workspace_kv (
            workspace_id,
            key,
            value_json,
            updated_at
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(workspace_id, key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_at = excluded.updated_at
        """
        audit_sql = """
        INSERT INTO workspace_audit (
            id,
            workspace_id,
            principal_id,
            action,
            key,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """

        with self._lock, self._connect() as connection:
            self._assert_owner(
                connection,
                principal_id,
                workspace_id,
            )
            connection.execute(
                upsert_sql,
                (workspace_id, key, encoded, now),
            )
            connection.execute(
                audit_sql,
                (
                    uuid.uuid4().hex,
                    workspace_id,
                    principal_id,
                    "put",
                    key,
                    now,
                ),
            )

    def get(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
    ) -> Any | None:
        if not self.settings.enabled:
            raise RuntimeError("Server persistence is disabled.")

        sql = """
        SELECT value_json
        FROM workspace_kv
        WHERE workspace_id = ? AND key = ?
        """

        with self._lock, self._connect() as connection:
            self._assert_owner(
                connection,
                principal_id,
                workspace_id,
            )
            row = connection.execute(
                sql,
                (workspace_id, key),
            ).fetchone()

            if row is None:
                return None

            return json.loads(row["value_json"])

    def delete(
        self,
        *,
        principal_id: str,
        workspace_id: str,
        key: str,
    ) -> None:
        if not self.settings.enabled:
            raise RuntimeError("Server persistence is disabled.")

        now = int(time.time())
        delete_sql = """
        DELETE FROM workspace_kv
        WHERE workspace_id = ? AND key = ?
        """
        audit_sql = """
        INSERT INTO workspace_audit (
            id,
            workspace_id,
            principal_id,
            action,
            key,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """

        with self._lock, self._connect() as connection:
            self._assert_owner(
                connection,
                principal_id,
                workspace_id,
            )
            connection.execute(
                delete_sql,
                (workspace_id, key),
            )
            connection.execute(
                audit_sql,
                (
                    uuid.uuid4().hex,
                    workspace_id,
                    principal_id,
                    "delete",
                    key,
                    now,
                ),
            )

    @staticmethod
    def _assert_owner(
        connection: sqlite3.Connection,
        principal_id: str,
        workspace_id: str,
    ) -> None:
        sql = """
        SELECT owner_principal_id
        FROM workspaces
        WHERE id = ?
        """

        row = connection.execute(
            sql,
            (workspace_id,),
        ).fetchone()

        if row is None:
            raise KeyError("Workspace not found.")

        if row["owner_principal_id"] != principal_id:
            raise PermissionError("Workspace access denied.")
