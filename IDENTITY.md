# ContextForge Identity and Workspace Foundation

ContextForge now has an identity/workspace isolation layer without pretending
that full authentication already exists.

## Current behavior

The public-beta application still runs without login.

On first browser use, ContextForge creates a stable local principal and a
`Personal workspace`. Browser-local state is stored under a namespace containing:

- storage schema version,
- principal id,
- workspace id,
- original ContextForge storage key.

Existing pre-isolation browser values migrate into the scoped namespace on first
read.

This means histories, baselines, quality profiles, compile-policy bundles,
execution-guard settings, audits, and onboarding state are no longer represented
as globally shared browser keys.

## Why this matters

This creates the ownership boundary needed before introducing real accounts.

A future authentication provider can replace the local principal with an
authenticated principal while retaining the same workspace-scoped storage API.

The workspace contract rejects activating a workspace whose owner does not match
the active principal.

## Important limitation

This milestone is **not authentication** and does not claim server-side tenant
security.

Browser localStorage is controlled by the browser user. It is appropriate for
the current local-first beta state, but it is not an authorization boundary for
a hosted multi-user SaaS application.

Before cloud persistence is introduced, server-side storage must enforce:

1. authenticated principal identity,
2. workspace membership,
3. owner/member authorization,
4. workspace id filtering on every read/write,
5. server-generated or server-validated tenant identifiers,
6. audit logging for workspace-sensitive mutations.

## Validation

```powershell
.\engine\.venv\Scripts\python.exe .\tools\validate_workspace_isolation.py
.\tools\run_deployment_preflight.ps1
.\tools\run_release_gate.ps1
```
