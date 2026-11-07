@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================================
echo   SysADV v0.10.0 - Atualizacao apenas do frontend BLOQUEADA
 echo ============================================================
echo [ATENCAO] Esta release inclui tabelas PostgreSQL e rotas novas na API.
echo [ACAO] Execute primeiro VALIDAR_AMBIENTE.bat.
echo [ACAO] Depois execute TESTAR_BUILD_SEM_INSTALAR.bat.
echo [ACAO] Execute ATUALIZAR_SISTEMA.bat somente apos o teste passar.
echo O atualizador completo preserva backup de banco antes do schema.
exit /b 1
