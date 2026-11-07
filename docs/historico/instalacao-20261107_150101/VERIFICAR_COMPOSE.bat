@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo [SysADV v0.9.2-r2] Verificando docker-compose.yml...
if not exist "docker-compose.yml" (
  echo [ERRO] docker-compose.yml nao encontrado.
  exit /b 1
)
if not exist ".env" (
  echo [AVISO] .env nao encontrado. Execute ATUALIZAR_SISTEMA.bat para criar, ou configure manualmente.
  exit /b 1
)
docker compose -f "docker-compose.yml" config --quiet
if errorlevel 1 (
  echo [ERRO] Compose invalido. Execute REPARAR_COMPOSE.bat.
  exit /b 1
)
echo [OK] Docker Compose validado.
docker compose -f "docker-compose.yml" config --services
exit /b 0
