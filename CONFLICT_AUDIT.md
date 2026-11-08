# ContextForge Persistent Conflict History and Recovery Audit

Cross-device conflict detection and resolution now produce durable server-side
audit records.

Each record captures:

- workspace,
- authenticated principal,
- storage key,
- expected revision,
- actual server revision,
- displaced local action,
- detection timestamp,
- resolution choice,
- resolution timestamp.

The recovery UI can query recent conflict history through the authenticated
same-origin web API. Conflict records are workspace-scoped and ownership
checks are enforced server-side.
