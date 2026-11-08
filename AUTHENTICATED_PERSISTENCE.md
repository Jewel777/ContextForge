# ContextForge Authenticated Server Persistence

This milestone connects the Auth.js web session to the server-side workspace
persistence boundary.

Flow:
1. Browser calls the same-origin Next.js workspace-state API.
2. Next.js validates the Auth.js session.
3. Next.js forwards the authenticated principal to the private engine.
4. The engine resolves the trusted principal contract.
5. The persistence layer verifies workspace ownership.
6. Reads, writes, and deletes are scoped to that workspace.

Anonymous/local mode remains browser-local only.

Server persistence remains disabled until both settings are intentionally enabled:

CONTEXTFORGE_AUTH_MODE=trusted_header
CONTEXTFORGE_SERVER_PERSISTENCE_ENABLED=true

The initial sync allow-list is intentionally conservative.

Validation:
- tools/validate_authenticated_persistence.py
- tools/run_deployment_preflight.ps1
- tools/run_release_gate.ps1
