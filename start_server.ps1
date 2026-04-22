$env:DATABASE_URL="postgresql://postgres:SaCnffbRJGuLCFzKFFrwHgstQEDeyvUY@shinkansen.proxy.rlwy.net:19969/railway"
$env:JWT_SECRET="pharmadist_super_secret_2026_xyz789abc"
$env:NODE_ENV="production"
$env:ADMIN_EMAIL="vishal@dormed.com"
$env:ADMIN_PASSWORD="DORMEDS@2026"

Set-Location "C:\Users\Vishal\10000\server"

Write-Host "=========================================" -ForegroundColor Green
Write-Host " PharmaDist Pro - Starting Server..." -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Connecting to Railway PostgreSQL database..."
Write-Host "Server starting on http://localhost:5000"

# Start the server
& "C:\Program Files\nodejs\node.exe" server.js
