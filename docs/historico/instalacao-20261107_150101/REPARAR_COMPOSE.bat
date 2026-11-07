@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ============================================================
echo   SysADV v0.9.2-r2 - Reparar docker-compose.yml
echo ============================================================

if not exist "config\docker-compose.v0.9.2-r2.yml" (
  echo [ERRO] Template validado nao localizado em config.
  exit /b 1
)

if not exist "backups\config" mkdir "backups\config"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel criar pasta de backup da configuracao.
  exit /b 1
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss_fff"') do set "CONFIG_STAMP=%%I"
if not defined CONFIG_STAMP (
  echo [ERRO] Nao foi possivel gerar nome do backup.
  exit /b 1
)

if exist "docker-compose.yml" (
  copy /Y "docker-compose.yml" "backups\config\docker-compose_!CONFIG_STAMP!.yml" >nul
  if errorlevel 1 (
    echo [ERRO] Backup do compose falhou, nada foi substituido.
    exit /b 1
  )
  echo [OK] Compose anterior salvo em backups\config\docker-compose_!CONFIG_STAMP!.yml
)

copy /Y "config\docker-compose.v0.9.2-r2.yml" "docker-compose.yml" >nul
if errorlevel 1 (
  echo [ERRO] Falha ao restaurar o compose.
  exit /b 1
)

echo [OK] docker-compose.yml restaurado a partir do template v0.9.2-r2.
if not exist ".env" (
  echo [AVISO] Arquivo .env ausente. Crie um .env seguro antes de executar o atualizador.
  exit /b 0
)

docker version >nul 2>&1
if errorlevel 1 (
  echo [AVISO] Docker indisponivel. Valide depois com docker compose -f docker-compose.yml config --quiet.
  exit /b 0
)

docker compose -f "docker-compose.yml" config --quiet
if errorlevel 1 (
  echo [ERRO] A validacao do Compose falhou. Veja mensagens acima.
  exit /b 1
)

echo [OK] Configuracao Docker Compose aprovada.
exit /b 0
