# SysADV QA6: ajuste tipado do validador Zod; nao acessa o banco de dados.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$patchRoot = $PSScriptRoot
$root = (Resolve-Path (Join-Path $patchRoot '..')).Path
$relative = 'apps\api\src\modules\office\office-policy.ts'
$target = Join-Path $root $relative
$replacement = Join-Path $patchRoot (Join-Path 'payload' $relative)
$expectedBefore = '98CB02EFE09BA0DC0976BAB45ECAC7E3EB1EA9D227550F1D1A0BD3CB45B87DF6'
$expectedAfter = '6D9EF2A89B90D85207B77C112C86672793C827171DC5E7A81DC1A6B4C7A32280'
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Arquivo nao encontrado: $target" }
if (-not (Test-Path -LiteralPath $replacement -PathType Leaf)) { throw "Payload ausente: $replacement" }
if ((Get-FileHash -LiteralPath $replacement -Algorithm SHA256).Hash -ne $expectedAfter) { throw 'Integridade do hotfix invalida.' }
$existingHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
if ($existingHash -eq $expectedAfter) {
  Write-Host '[OK] QA6 ja aplicado; nenhuma alteracao.' -ForegroundColor Green
  exit 0
}
if ($existingHash -ne $expectedBefore) {
  throw 'Arquivo office-policy.ts diferente da base esperada. Nenhuma alteracao foi feita. Nao sobrescreva uma versao personalizada.'
}
$stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$backup = Join-Path $root (Join-Path 'backups_hotfix_qa6' (Join-Path $stamp ($relative + '.bak')))
New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
Copy-Item -LiteralPath $target -Destination $backup -Force
try {
  Copy-Item -LiteralPath $replacement -Destination $target -Force
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $expectedAfter) { throw 'Hash de destino incorreto.' }
  Write-Host '[OK] Validador Zod corrigido (TS2345: internalBusinessDays).' -ForegroundColor Green
  Write-Host "[OK] Backup salvo em: $backup"
  Write-Host 'Reexecute .\HOMOLOGAR_COMPLETO.bat em ambiente isolado.' -ForegroundColor Cyan
} catch {
  Copy-Item -LiteralPath $backup -Destination $target -Force
  throw
}
