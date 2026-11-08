# ContextForge Conflict Anomaly Detection and Automated Remediation

ContextForge now analyzes persistent cross-device conflict history for unusual
operational patterns instead of reporting only raw counts.

The detector evaluates:

- short-term conflict spikes against the recent daily baseline,
- unresolved conflict backlog,
- large revision gaps from stale clients,
- repeated contention on the same durable key,
- concentration of conflicts in a single state record,
- local-reapply resolution skew.

The result contains a deterministic 0-100 anomaly score, severity, detected
signals, likely root-cause patterns, and concrete remediation recommendations.

The analyzer is deliberately deterministic and explainable: every score
contribution is surfaced as a signal rather than hidden behind an opaque model.
