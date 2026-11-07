@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo SysADV - Gate de implantacao (nao altera dados sem aceite)
 echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0IMPLANTAR_APOS_HOMOLOGACAO.ps1" %*
exit /b %ERRORLEVEL%
