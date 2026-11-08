# ContextForge Guardrail Policy Rollback and Safe Manual Override

Advanced users can now temporarily pin guardrail thresholds or restore a
previous audited policy.

Safety properties:

- all manual/rollback values are clamped to deterministic hard safety bounds;
- only one override can be active per workspace/key;
- applying a new override clears the previous active override;
- clearing an override immediately returns the key to adaptive auto-tuning;
- rollback records the source audit ID and reason;
- server-side workspace ownership checks remain enforced.

This feature does not weaken optimistic-concurrency enforcement. It only
controls warning, refresh, critical, and backoff thresholds within the already
defined safety envelope.
