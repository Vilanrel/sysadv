@echo off
cd /d "%~dp0"
echo === Containers ===
docker compose -p sysadv -f docker-compose.yml ps -a
echo.
echo === Release esperada ===
powershell -NoProfile -Command "(Get-Content -LiteralPath 'config\release.json' -Raw -Encoding UTF8 | ConvertFrom-Json).release"
echo.
echo === Versao da API ===
powershell -NoProfile -Command "try { Invoke-RestMethod -TimeoutSec 5 http://localhost:3001/api/system/version | ConvertTo-Json -Depth 5 } catch { Write-Host $_.Exception.Message; exit 1 }"
echo.
echo === Health ===
powershell -NoProfile -Command "try { Invoke-RestMethod -TimeoutSec 5 http://localhost:3001/api/health | ConvertTo-Json } catch { Write-Host $_.Exception.Message; exit 1 }"
