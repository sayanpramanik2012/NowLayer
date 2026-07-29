@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [NowLayer] Node.js was not found. Install Node.js 18 or newer first.
  goto :failed
)

if not exist "node_modules\electron\package.json" (
  echo [NowLayer] Installing the Electron development runtime...
  call npm.cmd install
  if errorlevel 1 goto :failed
)

echo [NowLayer] Running checks...
call npm.cmd run build
if errorlevel 1 goto :failed

echo [NowLayer] Starting. Keep this window open while testing.
call npm.cmd run dev
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo [NowLayer] Startup stopped because a step failed. Read TESTING.md or copy this error.
pause
exit /b 1
