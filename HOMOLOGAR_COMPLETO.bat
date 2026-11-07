@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo SysADV - Build completo + homologacao isolada PostgreSQL/Web
 echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0HOMOLOGAR_COMPLETO.ps1" %*
exit /b %ERRORLEVEL%
