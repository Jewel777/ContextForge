# ContextForge Server-Side Identity and Persistence Foundation

This milestone introduces the server-side tenant storage boundary required before
ContextForge can become a hosted multi-user product.

It does **not** pretend that ContextForge already has end-user authentication.

## Added architecture

The engine now contains:

- an authentication adapter contract,
- a server persistence configuration contract,
- SQLite-backed principal/workspace storage,
- workspace ownership checks on every key/value access,
- workspace-scoped persistence,
- workspace mutation audit records,
- foreign-key constraints and cascade cleanup,
- production configuration validation.

## Authentication modes

`CONTEXTFORGE_AUTH_MODE=disabled`

This is the default and safest current setting.

`CONTEXTFORGE_AUTH_MODE=trusted_header`

This mode is intended only for future deployment behind an identity-aware reverse
proxy that authenticates the user, strips client-supplied identity headers, and
injects trusted principal headers.

It must not be enabled on a directly exposed engine.

## Persistence

Server persistence is disabled by default:

```text
CONTEXTFORGE_SERVER_PERSISTENCE_ENABLED=false
```

When a real authentication boundary is connected, it can be enabled with a
server-side SQLite database for a single-node beta deployment.

The persistence implementation verifies that the requesting principal owns the
workspace before every get, put, or delete operation.

## Important limit

SQLite is appropriate for a single-instance beta or local deployment.

Before horizontally scaling ContextForge, the storage adapter should move to a
shared transactional database such as PostgreSQL while retaining the same
principal/workspace ownership contract.

## Validation

```powershell
.\engine\.venv\Scripts\python.exe .\tools\validate_server_persistence.py
.\tools\run_deployment_preflight.ps1
.\tools\run_release_gate.ps1
```
