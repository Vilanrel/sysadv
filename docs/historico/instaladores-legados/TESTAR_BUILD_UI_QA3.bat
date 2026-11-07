@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================================
echo SysADV v0.10.1-qa3 - Build do frontend SEM instalar
echo ============================================================
docker compose -f docker-compose.yml config --quiet
if errorlevel 1 (
  echo [ERRO] Docker Compose invalido.
  exit /b 1
)
docker compose -f docker-compose.yml build sysadv-web
if errorlevel 1 (
  echo [ERRO] Build sysadv-web falhou; os containers e volumes existentes nao foram alterados.
  exit /b 1
)
echo [OK] Frontend compilado. Para homologacao completa execute HOMOLOGAR_COMPLETO.bat.
exit /b 0
