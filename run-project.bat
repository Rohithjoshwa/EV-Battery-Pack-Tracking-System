@echo off
cd /d "%~dp0"
echo Installing frontend dependencies...
npm install
if errorlevel 1 (
  echo npm install failed. Please install Node.js LTS.
  pause
  exit /b 1
)
echo Starting project with Java backend...
npm start
pause
