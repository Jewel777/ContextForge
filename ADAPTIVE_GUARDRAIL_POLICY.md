# ContextForge Adaptive Guardrail Policy and Auto-Tuning

ContextForge now adjusts preventive conflict guardrails using observed conflict
history while preserving deterministic hard safety limits.

The policy is derived per workspace and key from:

- unresolved conflict ratio,
- local-reapply ratio,
- average revision gap,
- maximum revision gap,
- available historical sample size.

The tuned policy controls:

- warning threshold,
- mandatory refresh threshold,
- critical threshold,
- preventive backoff scale.

Auto-tuning is intentionally bounded. Warning, refresh, critical, and backoff
values cannot move outside fixed hard safety ranges, so the system can adapt
without silently weakening optimistic-concurrency protection.
