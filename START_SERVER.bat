@echo off
title PharmaDist Pro Server
color 0A

echo.
echo  =========================================
echo   PharmaDist Pro - Starting Server...
echo  =========================================
echo.

:: Kill any existing server on port 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Set PATH so node can be found
set PATH=C:\Program Files\nodejs;%PATH%

:: Connect to Railway PostgreSQL (live database)
set DATABASE_URL=postgresql://postgres:SaCnffbRJGuLCFzKFFrwHgstQEDeyvUY@shinkansen.proxy.rlwy.net:19969/railway
set JWT_SECRET=pharmadist_super_secret_2026_xyz789abc
set NODE_ENV=production

:: ── ADMIN CREDENTIALS (must match Railway Variables) ──────────
:: Change these to match what you set in Railway → Variables tab
set ADMIN_EMAIL=vishal@dormed.com
set ADMIN_PASSWORD=DORMEDS@2026

:: Change to server directory
cd /d "C:\Users\Vishal\10000\server"

echo  Connecting to Railway PostgreSQL database...
echo  Server starting on http://localhost:5000
echo.
echo  Opening browser in 3 seconds...
echo.

:: Open browser after 3 second delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

:: Start the server
echo  Press Ctrl+C to stop the server.
echo  =========================================
echo.
node server.js

echo.
echo  Server stopped.
pause
