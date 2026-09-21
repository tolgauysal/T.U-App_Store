@echo off
REM Start static and auth servers in separate windows
cd /d "%~dp0"
start "Static Server" cmd /k "node server.js"
start "Auth Server" cmd /k "node auth-server.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"
echo Sunucular başlatıldı ve site açıldı.
