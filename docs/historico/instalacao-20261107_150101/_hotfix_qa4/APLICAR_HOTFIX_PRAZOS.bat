@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0APLICAR_HOTFIX_PRAZOS.ps1"
exit /b %ERRORLEVEL%
