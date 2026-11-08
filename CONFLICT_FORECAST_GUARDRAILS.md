# ContextForge Conflict Forecasting and Preventive Guardrails

ContextForge now evaluates conflict risk before authenticated durable-state
writes.

The forecast combines:

- recent conflicts on the target key,
- the key's share of workspace conflicts,
- repeated stale-write history,
- recent revision gaps,
- unresolved conflict backlog,
- workspace anomaly pressure,
- action type.

The result is a deterministic 0-100 write-risk score. Medium-risk writes
surface a warning. High- and critical-risk writes automatically refresh the
latest server revision before the mutation proceeds, reducing preventable
optimistic-concurrency failures without weakening server-side stale-write
protection.

Anonymous/local-only mode remains unaffected.
