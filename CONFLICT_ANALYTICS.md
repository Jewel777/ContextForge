# ContextForge Conflict Analytics and Operational Health

ContextForge now aggregates persistent cross-device conflict history into an
operational-health snapshot for authenticated workspaces.

The snapshot includes:

- conflicts in the last 24 hours and 7 days,
- unresolved conflict count,
- cloud-versus-local resolution mix,
- average and maximum revision gap,
- hot conflict keys,
- repeated stale-write keys,
- seven-day daily trend,
- a deterministic 0-100 workspace conflict-health score.

The analytics endpoint remains workspace-scoped and inherits the same
server-side ownership checks as the persistent conflict audit.
