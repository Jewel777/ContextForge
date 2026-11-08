# ContextForge Advanced Operations UI Consolidation

The previous conflict/audit controls were mounted globally as independent
floating buttons, which made Standard mode look like a developer console.

They are now consolidated into one Advanced-only Operations & Reliability hub.

The hub contains four views:

- Conflict health
- Conflict anomaly analysis
- Recovery audit
- Guardrail policy history

Runtime conflict alerts and preventive write-risk warnings remain global because
they are safety signals, not navigation.

The Operations launcher stays hidden unless the Advanced experience is active.
