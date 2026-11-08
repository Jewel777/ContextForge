$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root "engine\.venv\Scripts\python.exe"
$Reporter = Join-Path $PSScriptRoot "contextforge_release_report.py"

if (-not (Test-Path $Python)) {
    throw "Missing virtualenv Python: $Python"
}

& $Python $Reporter
exit $LASTEXITCODE
