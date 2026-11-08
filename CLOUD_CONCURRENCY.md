# ContextForge Cloud Concurrency

Cross-device cloud workspace state now uses optimistic concurrency.

Each workspace-state record has a revision. Writes and deletes compare the
client's expected revision with the current server revision inside an
immediate SQLite transaction.

If the revisions differ, the server returns HTTP 409 instead of overwriting
newer cloud state.

The browser then re-fetches the authoritative record, restores it locally,
emits `contextforge:cloud-conflict`, and applies the deterministic
`server-wins` policy.

This milestone is implemented in `engine/concurrency.py`, leaving the existing
persistence bootstrap code unchanged.
