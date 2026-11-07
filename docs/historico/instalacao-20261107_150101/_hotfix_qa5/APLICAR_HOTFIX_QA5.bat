@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0APLICAR_HOTFIX_QA5.ps1"
exit /b %ERRORLEVEL%
