# +------------------------------------------------------------+
# |  Fiber Merchant Kit - One-Command Start (Windows)          |
# |                                                            |
# |  This script installs dependencies and starts all          |
# |  three services concurrently:                              |
# |    - API Server      -> http://localhost:3001               |
# |    - Admin Dashboard -> http://localhost:5173               |
# |    - Demo Store      -> http://localhost:5174               |
# +------------------------------------------------------------+

param(
    [switch]$NoInstall
)

Write-Host ""
Write-Host "  Fiber Merchant Kit" -ForegroundColor Cyan
Write-Host "  ====================" -ForegroundColor Cyan
Write-Host ""

# -- Install dependencies -------------------------------------
if (-not $NoInstall) {
    Write-Host "  Installing dependencies..." -ForegroundColor Yellow
    npm install --silent
    Write-Host "  Dependencies installed." -ForegroundColor Green
    Write-Host ""
}

# -- Copy .env files if they don't exist -----------------------
if (-not (Test-Path packages/api-server/.env) -and (Test-Path packages/api-server/.env.example)) {
    Copy-Item packages/api-server/.env.example packages/api-server/.env
    Write-Host "  Created packages/api-server/.env from .env.example" -ForegroundColor Gray
}
if (-not (Test-Path packages/admin-dashboard/.env) -and (Test-Path packages/admin-dashboard/.env.example)) {
    Copy-Item packages/admin-dashboard/.env.example packages/admin-dashboard/.env
    Write-Host "  Created packages/admin-dashboard/.env from .env.example" -ForegroundColor Gray
}
if (-not (Test-Path packages/demo-store/.env) -and (Test-Path packages/demo-store/.env.example)) {
    Copy-Item packages/demo-store/.env.example packages/demo-store/.env
    Write-Host "  Created packages/demo-store/.env from .env.example" -ForegroundColor Gray
}
Write-Host ""

# -- Start all services ----------------------------------------
Write-Host "  Starting services..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  +-------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |  API Server:      http://localhost:3001               |" -ForegroundColor Cyan
Write-Host "  |  Admin Dashboard: http://localhost:5173               |" -ForegroundColor Cyan
Write-Host "  |  Demo Store:      http://localhost:5174               |" -ForegroundColor Cyan
Write-Host "  +-------------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Look for the API key in the server logs above." -ForegroundColor Yellow
Write-Host "  Enter it in the dashboard at http://localhost:5173" -ForegroundColor Yellow
Write-Host ""

npm run dev
