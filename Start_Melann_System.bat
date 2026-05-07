@echo off
title Melann Lending System Launcher
echo ==========================================
echo Starting Melann Lending System...
echo ==========================================
echo.

cd /d "c:\Users\Admin\OneDrive\Documents\Project System\MelannPastDueReportMonitoring"

echo [1/3] Starting Backend Server...
start "Melann Backend (Node)" cmd /k "color 0A & title Melann Backend Server & npm run server"

echo [2/3] Starting Frontend Server...
start "Melann Frontend (Vite)" cmd /k "color 0B & title Melann Frontend Server & npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 8 /nobreak >nul

echo.
echo Opening Google Chrome to http://localhost:3000 ...
start chrome http://localhost:3000

echo.
echo Launch complete! 
echo Keep the newly opened command windows running while using the system.
echo Close those windows when you are done to stop the servers.
echo You can close this launcher window now.
timeout /t 5 >nul
