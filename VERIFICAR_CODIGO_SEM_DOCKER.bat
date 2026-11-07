@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================================
echo  SysADV - Verificacao offline (Node 22)
echo ============================================================
where node >nul 2>&1
if errorlevel 1 ( echo [ERRO] Node.js nao encontrado. & exit /b 1 )
node scripts\check-esm-imports.mjs
if errorlevel 1 exit /b 1
node scripts\validate-office-release.mjs
if errorlevel 1 exit /b 1
node --experimental-strip-types --test tests\office\office-math.test.ts
if errorlevel 1 exit /b 1
echo [OK] Verificacoes offline aprovadas.
echo [AVISO] Nao substituem compilacao Docker nem banco PostgreSQL.
exit /b 0
