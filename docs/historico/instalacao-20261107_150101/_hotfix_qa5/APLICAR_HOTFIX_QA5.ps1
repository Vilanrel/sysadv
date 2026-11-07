# SysADV QA5: fix doubleBasis TS2345 without modifying the database.
$ErrorActionPreference = 'Stop'
$patchRoot = $PSScriptRoot
$root = (Resolve-Path (Join-Path $patchRoot '..')).Path
$relative = 'apps\api\src\modules\deadlines\deadlines.routes.ts'
$target = Join-Path $root $relative
$replacement = Join-Path $patchRoot (Join-Path 'payload' $relative)
$expectedBefore = 'DC7634C67800BDAE535B4F5E1824BE09D0124BF8CE3217E2AFFC350816E32DE9'
$expectedAfter = 'B53219EA9957524BA7AD220903DF297298AE529F2C251E5835F93665B1408923'
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Arquivo nao encontrado: $target" }
if (-not (Test-Path -LiteralPath $replacement -PathType Leaf)) { throw "Payload ausente: $replacement" }
if ((Get-FileHash -LiteralPath $replacement -Algorithm SHA256).Hash -ne $expectedAfter) { throw 'Hotfix com hash diferente do esperado.' }
$existingHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
if ($existingHash -eq $expectedAfter) {
  Write-Host '[OK] QA5 ja esta aplicado. Nenhuma alteracao.' -ForegroundColor Green
  exit 0
}
if ($existingHash -ne $expectedBefore) {
  throw 'O arquivo local difere da base QA4. Nada foi alterado. Confira a versao antes de aplicar o hotfix.'
}
$stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$backup = Join-Path $root (Join-Path 'backups_hotfix_qa5' (Join-Path $stamp ($relative + '.bak')))
New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
Copy-Item -LiteralPath $target -Destination $backup -Force
try {
  Copy-Item -LiteralPath $replacement -Destination $target -Force
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $expectedAfter) { throw 'Hash final incorreto.' }
  Write-Host '[OK] Correcao TS2345 doubleBasis aplicada.' -ForegroundColor Green
  Write-Host "[OK] Backup do arquivo: $backup"
  Write-Host 'Reexecute .\HOMOLOGAR_COMPLETO.bat antes de qualquer implantacao.' -ForegroundColor Cyan
} catch {
  Copy-Item -LiteralPath $backup -Destination $target -Force
  throw
}
