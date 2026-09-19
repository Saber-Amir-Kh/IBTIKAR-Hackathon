Set-Location $PSScriptRoot
Write-Host "Starting Algeria Wildfire AI Microservice on Port 8001..." -ForegroundColor Green
if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    .\venv\Scripts\pip.exe install -r requirements.txt
}
.\venv\Scripts\python.exe main.py
