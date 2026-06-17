@echo off
title SCSMIS - Student Course Management

echo ========================================
echo   SCSMIS - Student Course Management
echo ========================================
echo.

echo [1/2] Starting Web Server on port 3000...
start "SCSMIS-Web" cmd /c "cd /d %~dp0 && node app.js"

echo [2/2] Starting ngrok tunnel and fetching public URL...
echo.
echo    Please wait about 5 seconds...
echo.

REM Start ngrok in background
start "SCSMIS-ngrok" cmd /c "cd /d %~dp0 && ngrok http 3000"

REM Wait for ngrok API to be ready
timeout /t 5 /nobreak >nul

REM Fetch public URL from ngrok API and display it
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 10; $url = $r.tunnels[0].public_url; Write-Host ''; Write-Host '========================================' -ForegroundColor Cyan; Write-Host '  PUBLIC URL (share this link):' -ForegroundColor Green; Write-Host '  ' $url'/login' -ForegroundColor Yellow; Write-Host '========================================' -ForegroundColor Cyan; Write-Host ''; Start-Process $url'/login' } catch { Write-Host 'ngrok still starting, check the ngrok window...' }"

echo.
echo ========================================
echo   Local:  http://localhost:3000/login
echo ========================================
echo.
pause
