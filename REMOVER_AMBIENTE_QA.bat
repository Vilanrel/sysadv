@echo off
setlocal
cd /d "%~dp0"
rem Remove apenas containers/redes do projeto de homologacao informado.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0REMOVER_AMBIENTE_QA.ps1" -Projeto sysadvqa1107135812 -Executar
exit /b %ERRORLEVEL%
