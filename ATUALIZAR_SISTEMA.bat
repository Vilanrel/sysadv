@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ============================================================
echo   SysADV - Atualizacao COMPLETA com backup PostgreSQL
echo ============================================================

docker version >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Docker nao esta disponivel.
  exit /b 1
)

if not exist ".env" (
  echo [ERRO] .env nao encontrado. Configure os segredos com base no .env.example.
  echo [ACAO] Nao e seguro iniciar com chaves de exemplo para dados de clientes.
  exit /b 1
)

rem Impedir migracao seguida de seed com senha administrativa conhecida.
findstr /B /C:"SEED_ADMIN_PASSWORD=" ".env" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] SEED_ADMIN_PASSWORD nao configurada no .env.
  echo [ACAO] Crie uma senha forte e configure antes de qualquer migracao do banco.
  exit /b 1
)

if not exist "config\release.json" (
  echo [ERRO] config\release.json ausente.
  exit /b 1
)
for /f %%V in ('powershell -NoProfile -Command "(Get-Content -LiteralPath 'config\release.json' -Raw -Encoding UTF8 ^| ConvertFrom-Json).release"') do set "RELEASE=%%V"
if not defined RELEASE (
  echo [ERRO] Nao foi possivel carregar a release atual.
  exit /b 1
)
echo [ATENCAO] Esta rotina faz backup, sincroniza schema Prisma e seed.
echo [ATENCAO] Para atualizar somente codigo use PUBLICAR_VERSAO.bat.
echo [1/8] Verificando configuracao dos servicos...
if not exist "docker-compose.yml" (
  echo [ERRO] docker-compose.yml nao encontrado na pasta do sistema.
  echo [ACAO] Extraia o pacote completo na pasta do SysADV ou execute REPARAR_COMPOSE.bat.
  exit /b 1
)
docker compose -p sysadv -f "docker-compose.yml" config --quiet
if errorlevel 1 (
  echo [ERRO] Configuracao Docker Compose invalida.
  echo [ACAO] Restaurar docker-compose.yml do pacote final apos salvar copia do atual.
  echo [ACAO] Revalide o Compose antes de repetir a atualizacao.
  exit /b 1
)

echo [2/8] Compilando novas imagens ANTES de alterar a instalacao...
docker compose -p sysadv -f "docker-compose.yml" build sysadv-api sysadv-web sysadv-judicial-worker
if errorlevel 1 (
  echo [ERRO] Falha na compilacao. Containers atuais preservados.
  exit /b 1
)

echo [3/8] Iniciando ou conferindo PostgreSQL...
docker compose -p sysadv -f "docker-compose.yml" up -d --wait sysadv-postgres
if errorlevel 1 exit /b 1

echo [4/8] Criando backup completo do PostgreSQL...
if not exist "backups" mkdir "backups"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "BACKUP_STAMP=%%I"
if not defined BACKUP_STAMP (
  echo [ERRO] Nao foi possivel definir data do backup.
  exit /b 1
)
set "BACKUP_FILE=%~dp0backups\SysADV_!BACKUP_STAMP!.dump"
docker compose -p sysadv -f "docker-compose.yml" exec -T sysadv-postgres pg_dump -U sysadv -d sysadv -Fc > "!BACKUP_FILE!"
if errorlevel 1 (
  echo [ERRO] O backup falhou. Nenhuma alteracao sera feita no schema.
  if exist "!BACKUP_FILE!" del /q "!BACKUP_FILE!"
  exit /b 1
)
for %%B in ("!BACKUP_FILE!") do if %%~zB LEQ 1024 (
  echo [ERRO] Backup vazio ou incompleto. Atualizacao cancelada.
  exit /b 1
)
echo [OK] Backup salvo em !BACKUP_FILE!

echo [5/8] Sincronizando o schema sem autorizar perda de dados...
docker compose -p sysadv -f "docker-compose.yml" run --rm sysadv-api npx prisma db push
if errorlevel 1 (
  echo [ERRO] Prisma nao aplicou o schema. Consulte o erro antes de continuar.
  exit /b 1
)

echo [6/8] Cadastrando permissoes e preservando o usuario existente...
docker compose -p sysadv -f "docker-compose.yml" run --rm sysadv-api npm run db:seed
if errorlevel 1 exit /b 1

echo [7/8] Atualizando containers web, API e worker...
docker compose -p sysadv -f "docker-compose.yml" up -d --no-deps --force-recreate sysadv-api sysadv-web sysadv-judicial-worker
if errorlevel 1 exit /b 1

echo [8/8] Conferindo versao da API...
for /L %%I in (1,1,20) do (
  powershell -NoProfile -Command "try { $r=Invoke-RestMethod -TimeoutSec 3 http://localhost:3001/api/system/version; if ($r.version -eq '%RELEASE%') { Write-Host ('[OK] API SysADV ' + $r.version); exit 0 } else { exit 2 } } catch { exit 1 }"
  if not errorlevel 1 goto :success
  timeout /t 2 /nobreak >nul
)

echo [ERRO] A API nao confirmou a release %RELEASE%.
docker compose -p sysadv -f "docker-compose.yml" ps -a
docker compose -p sysadv -f "docker-compose.yml" logs --tail=100 sysadv-api
exit /b 1

:success
docker compose -p sysadv -f "docker-compose.yml" ps -a
echo.
echo Atualizacao concluida. Backup: !BACKUP_FILE!
echo Web: http://localhost:9080 ^(padrao; ajustavel por SYSADV_WEB_PORT^)
echo API: http://localhost:3001/api/system/version
exit /b 0
