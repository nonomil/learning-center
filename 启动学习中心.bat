@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Learning Center v0.1.1

where node >nul 2>&1
if errorlevel 1 (
  echo [Learning Center] Node.js was not found. Install Node.js and try again.
  pause
  exit /b 1
)

set "HOST=127.0.0.1"
set "PORT=7001"
echo [Learning Center] Version: v0.1.1
echo [Learning Center] Starting http://%HOST%:%PORT%/
start "Learning Center Server" cmd /k "set HOST=%HOST%&& set PORT=%PORT%&& node local-server.mjs"

for /l %%I in (1,1,20) do (
  powershell -NoProfile -Command "try { $null = Invoke-WebRequest -UseBasicParsing -Uri 'http://%HOST%:%PORT%/' -TimeoutSec 1 -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 goto :ready
  timeout /t 1 /nobreak >nul
)

echo [Learning Center] Server startup timed out. Check the server window.
pause
exit /b 1

:ready
start "" "http://%HOST%:%PORT%/"
echo [Learning Center] Opened http://%HOST%:%PORT%/
echo [Learning Center] Close the server window to stop the local service.
exit /b 0
