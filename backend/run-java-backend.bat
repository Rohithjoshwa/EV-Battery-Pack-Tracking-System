@echo off
cd /d "%~dp0"
echo Compiling Java backend...
javac JavaBackend.java
if errorlevel 1 (
  echo Java compile failed. Please install JDK 17 or above.
  pause
  exit /b 1
)
echo Starting Java backend on http://localhost:5000
java JavaBackend
pause
