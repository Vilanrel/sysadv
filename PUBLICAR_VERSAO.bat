@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================================
echo   SysADV - Publicar somente codigo da release principal
 echo ============================================================
if not exist ".env" (echo [ERRO] .env ausente. Nao criar nem sobrescrever. & exit /b 1)
if not exist "config\release.json" (echo [ERRO] Manifesto de release ausente. & exit /b 1)
for /f %%V in ('powershell -NoProfile -Command "(Get-Content -LiteralPath 'config\release.json' -Raw -Encoding UTF8 ^| ConvertFrom-Json).release"') do set "RELEASE=%%V"
if not defined RELEASE (echo [ERRO] Nao foi possivel identificar o release. & exit /b 1)
docker info >nul 2>&1
if errorlevel 1 (echo [ERRO] Docker Engine indisponivel. & exit /b 1)
docker compose -p sysadv -f docker-compose.yml config --quiet
if errorlevel 1 exit /b 1
echo [1/4] Build de API, Worker e Web (%RELEASE%) - sem alterar banco...
docker compose -p sysadv -f docker-compose.yml build sysadv-api sysadv-judicial-worker sysadv-web
if errorlevel 1 (echo [ERRO] Build falhou. Servicos atuais preservados. & exit /b 1)
echo [2/4] Confirmando PostgreSQL principal em execucao...
for /f %%I in ('docker compose -p sysadv -f docker-compose.yml ps -q sysadv-postgres') do set "DB_CONTAINER=%%I"
if not defined DB_CONTAINER (echo [ERRO] PostgreSQL principal nao esta em execucao. Nao reiniciaremos a API. & exit /b 1)
echo [3/4] Atualizando SOMENTE os servicos da aplicacao no projeto sysadv...
docker compose -p sysadv -f docker-compose.yml up -d --no-deps sysadv-api sysadv-judicial-worker sysadv-web
if errorlevel 1 exit /b 1
echo [4/4] Confirmando identificacao da API...
for /L %%N in (1,1,20) do (
  powershell -NoProfile -Command "try { $r=Invoke-RestMethod -TimeoutSec 3 http://127.0.0.1:3001/api/system/version; if ($r.version -eq '%RELEASE%') { Write-Host ('[OK] API release ' + $r.version); exit 0 } else { exit 2 } } catch { exit 1 }"
  if not errorlevel 1 goto :publicado
  timeout /t 2 /nobreak >nul
)
echo [ERRO] A API nao confirmou a release %RELEASE%. Confira logs; o banco nao foi modificado.
docker compose -p sysadv -f docker-compose.yml logs --tail=80 sysadv-api
exit /b 1
:publicado
echo [OK] Codigo publicado no projeto sysadv; banco e volumes preservados.
docker compose -p sysadv -f docker-compose.yml ps -a
exit /b 0
