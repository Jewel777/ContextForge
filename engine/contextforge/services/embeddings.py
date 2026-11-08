from __future__ import annotations

import hashlib
import sqlite3
import time
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import SentenceTransformer

from ..config import (
    CACHE_SCHEMA_VERSION,
    EMBEDDING_CACHE_DB,
    EMBEDDING_CACHE_MAX_ITEMS,
    EMBEDDING_MODEL_NAME,
)


class EmbeddingService:
    def __init__(self) -> None:
        self.model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        self.db_path = Path(EMBEDDING_CACHE_DB)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.execute("PRAGMA journal_mode=WAL;")
        connection.execute("PRAGMA synchronous=NORMAL;")
        return connection

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS embeddings (
                    cache_key TEXT PRIMARY KEY,
                    model_name TEXT NOT NULL,
                    schema_version TEXT NOT NULL,
                    text_hash TEXT NOT NULL,
                    dim INTEGER NOT NULL,
                    vector BLOB NOT NULL,
                    last_access REAL NOT NULL
                )
            """)
            columns = {row[1] for row in connection.execute("PRAGMA table_info(embeddings)").fetchall()}
            if "schema_version" not in columns:
                connection.execute(
                    "ALTER TABLE embeddings ADD COLUMN schema_version TEXT NOT NULL DEFAULT 'legacy'"
                )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_embeddings_last_access ON embeddings(last_access)"
            )

    @staticmethod
    def _hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def _key(self, text: str) -> str:
        return f"{CACHE_SCHEMA_VERSION}:{EMBEDDING_MODEL_NAME}:{self._hash(text)}"

    def _get(self, text: str):
        key = self._key(text)
        with self._connect() as connection:
            row = connection.execute(
                """SELECT dim, vector FROM embeddings
                   WHERE cache_key=? AND model_name=? AND schema_version=?""",
                (key, EMBEDDING_MODEL_NAME, CACHE_SCHEMA_VERSION),
            ).fetchone()
            if row is None:
                return None
            connection.execute(
                "UPDATE embeddings SET last_access=? WHERE cache_key=?",
                (time.time(), key),
            )
        dim, blob = row
        array = np.frombuffer(blob, dtype=np.float32, count=dim).copy()
        return torch.from_numpy(array)

    def _put(self, text: str, embedding: torch.Tensor) -> None:
        tensor = embedding.detach().cpu().to(torch.float32).flatten()
        array = tensor.numpy()
        key = self._key(text)
        with self._connect() as connection:
            connection.execute(
                """INSERT OR REPLACE INTO embeddings
                   (cache_key, model_name, schema_version, text_hash, dim, vector, last_access)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    key, EMBEDDING_MODEL_NAME, CACHE_SCHEMA_VERSION, self._hash(text),
                    int(array.shape[0]), array.tobytes(), time.time()
                )
            )
            count = connection.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
            overflow = max(0, count - EMBEDDING_CACHE_MAX_ITEMS)
            if overflow:
                connection.execute(
                    """DELETE FROM embeddings WHERE cache_key IN (
                       SELECT cache_key FROM embeddings ORDER BY last_access ASC LIMIT ?
                    )""",
                    (overflow,),
                )

    def encode_one(self, text: str):
        cached = self._get(text)
        if cached is not None:
            return cached
        emb = self.model.encode(text, convert_to_tensor=True).detach().cpu()
        self._put(text, emb)
        return emb

    def encode_many(self, texts):
        texts = list(texts)
        if not texts:
            return torch.empty((0, 0))
        output = [None] * len(texts)
        missing, indexes = [], []
        for i, text in enumerate(texts):
            cached = self._get(text)
            if cached is None:
                missing.append(text)
                indexes.append(i)
            else:
                output[i] = cached
        if missing:
            batch = self.model.encode(missing, convert_to_tensor=True).detach().cpu()
            for i, text, emb in zip(indexes, missing, batch):
                self._put(text, emb)
                output[i] = emb
        return torch.stack([x for x in output if x is not None])

    def cache_size(self) -> int:
        with self._connect() as connection:
            return int(connection.execute(
                "SELECT COUNT(*) FROM embeddings WHERE schema_version=? AND model_name=?",
                (CACHE_SCHEMA_VERSION, EMBEDDING_MODEL_NAME),
            ).fetchone()[0])

    def clear_cache(self) -> int:
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM embeddings WHERE schema_version=? AND model_name=?",
                (CACHE_SCHEMA_VERSION, EMBEDDING_MODEL_NAME),
            )
            return cursor.rowcount


embedding_service = EmbeddingService()
