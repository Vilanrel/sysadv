@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0HIGIENIZAR_ARQUIVOS_LOCAIS.ps1" -Executar
exit /b %ERRORLEVEL%
