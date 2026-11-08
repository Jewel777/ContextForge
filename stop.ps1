$ports = @(8001, 3000)
foreach ($port in $ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        try {
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
            Write-Host "Stopped process on port $port." -ForegroundColor Green
        } catch {
            Write-Host "Could not stop PID $($listener.OwningProcess) on port $port." -ForegroundColor Yellow
        }
    }
}
