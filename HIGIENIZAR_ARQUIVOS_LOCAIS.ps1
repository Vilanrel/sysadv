# Organiza instaladores obsoletos e notas antigas, sem excluir arquivos.
# Nunca toca em .env, Postgres, Docker, volumes, backups ou codigo ativo.
[CmdletBinding()]
param([switch]$Executar)
$ErrorActionPreference = 'Stop'
$root=$PSScriptRoot
$target=Join-Path $root ('docs\historico\instalacao-' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
$patterns=@('RELEASE_NOTES_v*.md','HOTFIX_*.md','CORRECAO_COMPOSE*.md','README_HOMOLOGACAO_v*.md','README_PRAZOS_E_QA*.md','RELATORIO_VALIDACAO_v*.md','VALIDACAO_OFFLINE*.txt','SHA256_COMPOSE_v*.txt')
$obsolete=@()
foreach ($pattern in $patterns) {
  $obsolete+=@(Get-ChildItem -LiteralPath $root -Filter $pattern -File -ErrorAction SilentlyContinue)
}
foreach ($name in @('REPARAR_COMPOSE.bat','VERIFICAR_COMPOSE.bat','ATUALIZAR_INTERFACE.bat','TESTAR_BUILD_UI_QA3.bat')) {
  $path=Join-Path $root $name
  if (Test-Path $path -PathType Leaf) { $obsolete+=Get-Item -LiteralPath $path }
}
$folders=@(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^_hotfix_qa[0-9]+$' })
$obsolete=@($obsolete | Sort-Object FullName -Unique)
Write-Host "Arquivos historicos encontrados: $($obsolete.Count); pastas: $($folders.Count)" -ForegroundColor Cyan
foreach ($item in $obsolete) { Write-Host ('  ' + $item.Name) }
foreach ($item in $folders) { Write-Host ('  ' + $item.Name + '\') }
if (-not $Executar) { Write-Host 'MODO PREVIA. Para organizar sem excluir, execute com -Executar'; exit 0 }
if ($obsolete.Count -eq 0 -and $folders.Count -eq 0) { Write-Host 'Nenhuma acao necessaria.'; exit 0 }
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($item in $obsolete) { Move-Item -LiteralPath $item.FullName -Destination $target }
foreach ($item in $folders) { Move-Item -LiteralPath $item.FullName -Destination $target }
Write-Host "[OK] Arquivos historicos guardados em $target" -ForegroundColor Green
