$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$engine = Join-Path $root "engine"
$web = Join-Path $root "web"
$backendPort = 8001
$frontendPort = 3000

function Test-Port([int]$Port) {
    try {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    } catch {
        return $false
    }
}

function Resolve-Python {
    $venv2 = Join-Path $engine ".venv2\Scripts\python.exe"
    $venv = Join-Path $engine ".venv\Scripts\python.exe"
    if (Test-Path $venv2) { return $venv2 }
    if (Test-Path $venv) { return $venv }
    return "python"
}

$python = Resolve-Python

Write-Host ""
Write-Host "ContextForge 2.1" -ForegroundColor Cyan
Write-Host "----------------"

if (!(Test-Port $backendPort)) {
    $backend = "Set-Location '$engine'; & '$python' -m uvicorn main:app --port $backendPort"
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backend
    Write-Host "Backend starting on port $backendPort..." -ForegroundColor Green
} else {
    Write-Host "Backend already running on port $backendPort." -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

if (!(Test-Port $frontendPort)) {
    $frontend = "Set-Location '$web'; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontend
    Write-Host "Frontend starting on port $frontendPort..." -ForegroundColor Green
} else {
    Write-Host "Frontend already running on port $frontendPort." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "App:      http://localhost:$frontendPort"
Write-Host "API:      http://127.0.0.1:$backendPort"
Write-Host "API Docs: http://127.0.0.1:$backendPort/docs"
Write-Host ""
