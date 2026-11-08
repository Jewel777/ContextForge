# ContextForge Authentication Integration

ContextForge now includes a real Auth.js session boundary with GitHub OAuth.

The integration is disabled until OAuth credentials are configured so the
existing local beta remains usable while authentication is prepared.

## Install

```powershell
cd web
npm install next-auth@latest
```

## Configure

Add these values to `.env.production`:

```text
CONTEXTFORGE_REQUIRE_AUTH=true
AUTH_SECRET=<strong random secret>
AUTH_GITHUB_ID=<GitHub OAuth App client id>
AUTH_GITHUB_SECRET=<GitHub OAuth App client secret>
```

For local development, place equivalent values in `web/.env.local`.

GitHub OAuth callback URL for local development:

```text
http://localhost:3000/api/auth/callback/github
```

## Protected surface

When `CONTEXTFORGE_REQUIRE_AUTH=true`, text and file compilation API routes
require a valid Auth.js session.

The Python engine remains private behind the Next.js web layer.

## Workspace adoption

After login, the authenticated principal is bridged into the existing
ContextForge workspace layer. Existing anonymous local workspace values are
re-keyed into the authenticated principal namespace on first adoption.

On sign-out, ContextForge returns to a local principal while the authenticated
principal's browser data remains isolated.

## Validation

```powershell
.\engine\.venv\Scripts\python.exe .\tools\validate_auth_integration.py
cd web
npm run build
```
