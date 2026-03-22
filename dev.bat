@echo off
title StudyX - Dev Mode
cd /d "%~dp0"

echo Pornind serverul Vite...
start "Vite Dev Server" cmd /c "node node_modules\vite\bin\vite.js"

echo Asteptam serverul...
timeout /t 3 /nobreak > nul

echo Pornind Electron...
set NODE_ENV=development
"node_modules\electron\dist\electron.exe" .
