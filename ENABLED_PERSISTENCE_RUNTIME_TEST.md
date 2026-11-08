# Enabled-Persistence Runtime Integration

ContextForge now has a release-blocking runtime integration check for the
production persistence/authentication boundary.

The validator launches a fresh Python process with:

- `CONTEXTFORGE_AUTH_MODE=trusted_header`
- `CONTEXTFORGE_AUTH_TRUST_PROXY=true`
- `CONTEXTFORGE_SERVER_PERSISTENCE_ENABLED=true`
- a unique temporary SQLite database

It verifies that the real engine imports successfully, trusted-header mode is
active, the `/health` route is registered, the persistence database is
created, core tables exist, and the guardrail override table migrates
successfully.

The test never writes to the configured development/production database.
The temporary database is removed after the check.

This catches the class of failures that structural validators missed earlier:
constructor-time database access, invalid persistence method names, missing
schema migrations, and import/startup failures that only appear when
persistence is actually enabled.
