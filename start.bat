@echo off
title StudyX - Pornire...
cd /d "%~dp0"

REM Ruleaza direct din dist/ (production mode)
set NODE_ENV=production
start "" "node_modules\electron\dist\electron.exe" .
