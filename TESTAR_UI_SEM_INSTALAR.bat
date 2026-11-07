@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo SysADV - Teste de build da interface
where docker >nul 2>&1
if errorlevel 1 ( echo [ERRO] Docker nao encontrado. & exit /b 1 )
docker compose -p sysadv -f "docker-compose.yml" config --quiet
if errorlevel 1 ( echo [ERRO] Docker Compose invalido. & exit /b 1 )
docker compose -p sysadv -f "docker-compose.yml" build sysadv-web
if errorlevel 1 ( echo [ERRO] Falha no build do frontend. & exit /b 1 )
echo [OK] Imagem web compilada. Containers e banco nao foram alterados.
exit /b 0
