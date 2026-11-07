@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0APLICAR_HOTFIX_QA6.ps1"
exit /b %ERRORLEVEL%
