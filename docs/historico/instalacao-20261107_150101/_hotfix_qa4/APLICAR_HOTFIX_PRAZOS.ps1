# SysADV v0.10.1-qa4 - update only four reviewed source files.
# This hotfix has no database, Docker or .env mutations.
$ErrorActionPreference = 'Stop'
$patchRoot = $PSScriptRoot
$root = (Resolve-Path (Join-Path $patchRoot '..')).Path
$payload = Join-Path $patchRoot 'payload'
$specs = @(
  @{ Rel = 'apps\api\src\modules\deadlines\deadlines.routes.ts'; Before = '871341BBEAFBCB0ED35C6CCA4572B24F22116DBFF5C70341DE8A99462F41A373'; After = 'DC7634C67800BDAE535B4F5E1824BE09D0124BF8CE3217E2AFFC350816E32DE9' }
  @{ Rel = 'apps\api\src\modules\deadlines\deadline-engine.ts'; Before = 'A094ADB60A4334F364D7CA4D1057BD586C2CCC24CC113028669B725D9D1B17E6'; After = '67A573A327F64A4000C3DFAD5CB745A797A10A506BCCDAB42877824EA3C11003' }
  @{ Rel = 'apps\web\src\features\deadlines\DeadlinesPage.tsx'; Before = '050F00712E6CDDB68D847F087E447FA57739561047BFC933495C8FC0A57B8F12'; After = 'E263A848AA2A5B4803B441582689EB77145DD6919B0D8024AAD8EA226643FA0A' }
  @{ Rel = 'scripts\tests\deadline-engine.test.mjs'; Before = '398AF22726AA1B26D4F636AA4DEED4C8672958F7E287EFA4F13180A630B95D8F'; After = '3BD543A33019A574092C8B5256FDBAFEE9F7039B8C025EEC181041B612AC1DE2' }
)
$toApply = @()
foreach ($spec in $specs) {
  $target = Join-Path $root $spec.Rel
  $replacement = Join-Path $payload $spec.Rel
  if (-not (Test-Path -LiteralPath $replacement -PathType Leaf)) { throw "Arquivo do hotfix ausente: $replacement" }
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Arquivo original ausente: $target" }
  $payloadHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $replacement).Hash
  if ($payloadHash -ne $spec.After) { throw "Payload alterado: $replacement" }
  $currentHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $target).Hash
  if ($currentHash -eq $spec.After) {
    Write-Host "[OK] Ja corrigido: $($spec.Rel)" -ForegroundColor Green
    continue
  }
  if ($currentHash -ne $spec.Before) {
    throw "Arquivo local modificado fora da base qa3: $target. Nao substituido. Envie o arquivo para revisao."
  }
  $toApply += [pscustomobject]@{ Target=$target; Payload=$replacement; Rel=$spec.Rel; Expected=$spec.After }
}
if ($toApply.Count -eq 0) {
  Write-Host '[OK] Hotfix ja aplicado. Sem alteracoes.' -ForegroundColor Green
  exit 0
}
$stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$backupRoot = Join-Path $root (Join-Path 'backups_hotfix_qa4' $stamp)
$completed = @()
try {
  foreach ($item in $toApply) {
    $backup = Join-Path $backupRoot ($item.Rel + '.bak')
    $backupDir = Split-Path -Parent $backup
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item -LiteralPath $item.Target -Destination $backup -Force
    # Register the backup BEFORE copying, so a partially written target is
    # restored even if the copy itself fails.
    $completed += [pscustomobject]@{ Target=$item.Target; Backup=$backup }
    Copy-Item -LiteralPath $item.Payload -Destination $item.Target -Force
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $item.Target).Hash
    if ($actual -ne $item.Expected) { throw "Falha na verificacao SHA-256: $($item.Target)" }
    Write-Host "[OK] Corrigido: $($item.Rel)" -ForegroundColor Green
  }
  Write-Host "[OK] Backup criado em $backupRoot" -ForegroundColor Green
  Write-Host 'Execute .\HOMOLOGAR_COMPLETO.bat para repetir a QA.' -ForegroundColor Cyan
} catch {
  foreach ($item in $completed) {
    Copy-Item -LiteralPath $item.Backup -Destination $item.Target -Force
  }
  throw
}
