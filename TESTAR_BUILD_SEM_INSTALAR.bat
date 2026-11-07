@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================================
echo  SysADV - Build completo sem alterar banco ou containers
 echo ============================================================
docker version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Docker Desktop nao disponivel.
  exit /b 1
)
docker compose -p sysadv -f "docker-compose.yml" config --quiet
if errorlevel 1 (
  echo [ERRO] Docker Compose invalido.
  exit /b 1
)
docker compose -p sysadv -f "docker-compose.yml" build sysadv-api sysadv-web sysadv-judicial-worker
if errorlevel 1 (
  echo [ERRO] Compilacao falhou. Banco e containers permanecem inalterados.
  exit /b 1
)
echo [OK] Build de API, Web e Worker aprovado.
echo Para publicar apenas codigo, execute PUBLICAR_VERSAO.bat.
exit /b 0
