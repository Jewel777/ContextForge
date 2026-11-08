# ContextForge Schema-Versioned Cloud State

ContextForge now has an explicit cloud-state registry and versioned payload
envelope for authenticated workspace persistence.

Current schema version: `1`

Registered durable keys:

- `contextforge-baseline`
- `contextforge-beta-onboarding-v1`
- `contextforge-bundle-execution-guard-audit`
- `contextforge-bundle-execution-guard-mode`
- `contextforge-compile-policy-bundle-restore-audit`
- `contextforge-compile-policy-bundle-revisions`
- `contextforge-compile-policy-bundles`
- `contextforge-quality-gate-policy`
- `contextforge-quality-gate-profile-revisions`
- `contextforge-quality-gate-profiles`
- `contextforge-quality-gate-restore-audit`

Each server value stores:

- schema version,
- storage key,
- update timestamp,
- serialized payload.

Unknown or future schema versions are not silently hydrated.

For authenticated users, cloud state is authoritative once it exists. If a key
does not yet exist in cloud storage, the current browser value seeds the server
once. Later local changes and deletes are mirrored to the server.

Anonymous/local mode remains browser-local.

Validation:

```powershell
.\engine\.venv\Scripts\python.exe .\tools\validate_cloud_state_schema.py
.\tools\run_deployment_preflight.ps1
.\tools\run_release_gate.ps1
```
