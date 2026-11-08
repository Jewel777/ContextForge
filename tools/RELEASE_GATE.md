# ContextForge Release Gate

Run before committing or tagging a milestone:

```powershell
cd "D:\Prompt_engine"
.\tools\run_release_gate.ps1
```

The gate validates:

- Git diff integrity
- original retrieval regression suite
- extended retrieval regression suite
- production benchmark
- frontend production build

Generated JSON and Markdown reports are written to `reports/` and ignored by Git so repeated release checks do not dirty the working tree.

Canonical outputs:

- `reports/release_report_latest.json`
- `reports/release_report_latest.md`
