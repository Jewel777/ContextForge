# ContextForge Guardrail Policy Audit and Explainable Change History

Adaptive guardrail policy changes are now persisted server-side whenever the
effective policy for a workspace/key actually changes.

Each audit record captures:

- workspace and authenticated principal,
- durable state key,
- warning / refresh / critical thresholds,
- backoff scale,
- historical sample size,
- tuning rationale,
- stable policy hash,
- previous policy hash,
- creation timestamp.

Identical recalculations are deduplicated, so the history represents real
policy transitions rather than repeated reads.

The Advanced audit view compares current and previous threshold values and
shows the exact tuning reasons that caused each change.
