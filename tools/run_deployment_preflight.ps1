$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root "engine\.venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "ContextForge Python virtual environment not found at $Python"
}

Write-Host ""
Write-Host "===================================================================="
Write-Host "ContextForge deployment preflight"
Write-Host "===================================================================="

& $Python (Join-Path $PSScriptRoot "validate_production_env.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_security_posture.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_server_persistence.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_authenticated_persistence.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_cloud_state_schema.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_cloud_concurrency.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_conflict_recovery_ux.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_conflict_audit.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_conflict_analytics.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_conflict_anomaly.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_conflict_forecast.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_guardrail_policy.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_guardrail_policy_audit.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_advanced_operations_ui.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_guardrail_override.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_enabled_persistence_runtime.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $PSScriptRoot "validate_top_alignment_ui.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location (Join-Path $Root "engine")
try {
    $PreviousPythonPath = $env:PYTHONPATH
    $env:PYTHONPATH = (Join-Path $Root "engine")

    & $Python ".\tests\test_retrieval_false_positive_regression.py"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    $env:PYTHONPATH = $PreviousPythonPath
    Pop-Location
}

& $Python (Join-Path $PSScriptRoot "validate_clipboard_fallback.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location (Join-Path $Root "web")
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "[PASS] Deployment preflight"










& $python "$PSScriptRoot\validate_standard_final_layout.py"

& $python "$PSScriptRoot\validate_standard_trust_summary.py"

& $python "$PSScriptRoot\validate_standard_inspector_scroll.py"

& $python "$PSScriptRoot\validate_result_metric_semantics.py"

& $python "$PSScriptRoot\validate_standard_evidence_trust.py"

& $python "$PSScriptRoot\validate_standard_trust_states.py"

& $python "$PSScriptRoot\validate_manifest_trust_metrics.py"

& $python "$PSScriptRoot\validate_manifest_trust_verdict.py"

& $python "$PSScriptRoot\validate_manifest_provenance_traceability.py"

& $python "$PSScriptRoot\validate_frontend_backend_trust_authority.py"

& $python "$PSScriptRoot\validate_standard_layout_contract.py"

& $python "$PSScriptRoot\validate_backend_trust_checks_ui.py"

& $python "$PSScriptRoot\validate_standard_trust_drilldown.py"

