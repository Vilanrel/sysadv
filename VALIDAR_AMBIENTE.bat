@echo off
setlocal
cd /d "%~dp0"
echo ======================================================
echo  SysADV 2026110701 - Diagnostico do ambiente
 echo ======================================================
where docker >nul 2>&1
if errorlevel 1 (
 echo [ERRO] Docker CLI nao encontrado no PATH.
 exit /b 1
)
docker version >nul 2>&1
if errorlevel 1 (
 echo [ERRO] Docker Engine para containers Linux nao esta acessivel.
 echo [ACAO] Abra Docker Desktop e aguarde Engine running.
 echo [ACAO] Verifique: docker context ls
 echo [ACAO] Se desktop-linux existir: docker context use desktop-linux
 echo [ACAO] Verifique WSL: wsl --status
 echo Nao remova containers, imagens ou volumes PostgreSQL.
 exit /b 1
)
if not exist ".env" (
 echo [ERRO] Arquivo .env nao encontrado. Preserve o .env da instalacao anterior.
 exit /b 1
)
docker compose -f "docker-compose.yml" config --quiet
if errorlevel 1 (
 echo [ERRO] Docker Compose invalido.
 exit /b 1
)
echo [OK] Docker Engine e Docker Compose disponiveis.
exit /b 0
