#!/usr/bin/env pwsh
# ============================================================
# SanketSetu — start both servers with a single command
# Usage:  .\start.ps1
#
# Starts:
#   Backend  → http://localhost:8000
#   Frontend → http://localhost:5173
# ============================================================

$ROOT     = $PSScriptRoot
$VENV_PY  = "$ROOT\.venv\Scripts\python.exe"
$VENV_UV  = "$ROOT\.venv\Scripts\uvicorn.exe"
$BACKEND  = "$ROOT\backend"
$FRONTEND = "$ROOT\frontend"

# ── sanity checks ──────────────────────────────────────────
if (-not (Test-Path $VENV_UV)) {
    Write-Error "venv not found. Run:  python -m venv .venv  then  .venv\Scripts\pip install -r backend\requirements.txt"
    exit 1
}
if (-not (Test-Path "$FRONTEND\node_modules")) {
    Write-Host "⚙ Installing frontend deps…" -ForegroundColor Cyan
    Push-Location $FRONTEND
    npm install
    Pop-Location
}

# ── port check & kill ─────────────────────────────────────
foreach ($port in @(8000, 5173)) {
    $pid_ = (netstat -ano | Select-String ":$port .*LISTENING") -replace '.*\s(\d+)$','$1' | Select-Object -Last 1
    if ($pid_) {
        Write-Host "[port $port] Freeing PID $pid_…" -ForegroundColor Yellow
        taskkill /PID $pid_ /F 2>$null | Out-Null
        Start-Sleep -Milliseconds 500
    }
}

# ── start backend in a new window ─────────────────────────
Write-Host "🚀 Starting backend on :8000 …" -ForegroundColor Green
$backendJob = Start-Process -FilePath "powershell.exe" -ArgumentList `
    "-NoProfile", "-Command",
    "Set-Location '$BACKEND'; & '$VENV_UV' app.main:app --port 8000" `
    -PassThru -WindowStyle Normal

# ── wait for backend ready (max 3 min) ────────────────────
Write-Host "⏳ Waiting for backend to load models (may take ~2 min)…" -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 36; $i++) {
    Start-Sleep -Seconds 5
    try {
        $r = Invoke-WebRequest "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ Backend ready: $($r.Content)" -ForegroundColor Green
        $ready = $true; break
    } catch { Write-Host "   …waiting ($([int]($i*5+5))s)" }
}
if (-not $ready) { Write-Warning "Backend didn't respond in time. Check the backend window." }

# ── start frontend ─────────────────────────────────────────
Write-Host "🌐 Starting frontend on :5173 …" -ForegroundColor Green
$frontendJob = Start-Process -FilePath "powershell.exe" -ArgumentList `
    "-NoProfile", "-Command",
    "Set-Location '$FRONTEND'; npm run dev" `
    -PassThru -WindowStyle Normal

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  SanketSetu is running!                  ║" -ForegroundColor Magenta
Write-Host "║  Frontend : http://localhost:5173         ║" -ForegroundColor Magenta
Write-Host "║  Backend  : http://localhost:8000         ║" -ForegroundColor Magenta
Write-Host "║  API Docs : http://localhost:8000/docs    ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "Press any key to stop both servers…" -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Stop-Process -Id $backendJob.Id  -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
Write-Host "Servers stopped." -ForegroundColor Red
