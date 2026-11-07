# Gate de liberacao do SysADV. Nao executar sem evidencias da mesma versao de codigo.
# Execucao: powershell -NoProfile -ExecutionPolicy Bypass -File .\IMPLANTAR_APOS_HOMOLOGACAO.ps1 -ConfirmarProducao
[CmdletBinding()]
param([switch]$ConfirmarProducao)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$root = $PSScriptRoot
$report = Join-Path $root 'qa_evidencias\ULTIMO_RESULTADO.json'
if (-not (Test-Path $report)) { throw 'Nao ha evidencia de homologacao. Execute HOMOLOGAR_COMPLETO.ps1 primeiro.' }
$qa = Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
if ($qa.status -ne 'passed') { throw "Homologacao nao aprovada: $($qa.reason)" }
foreach ($name in @('compose','build','prisma','postgresql','restore','worker','browser')) {
  if ($qa.stages.$name -ne 'passed') { throw "Fase $name nao aprovada" }
}
$elapsed = (Get-Date) - [DateTime]::Parse($qa.endedAt)
if ($elapsed.TotalHours -gt 24 -or $elapsed.TotalHours -lt 0) { throw 'Homologacao tem mais de 24 horas ou data invalida: execute novamente.' }
# Deve usar a MESMA lista/algoritmo de arquivos do script de homologacao.
$items = @('apps','packages','prisma','scripts','tests','package.json','config/release.json','config/release-history.json','.dockerignore','docker-compose.yml','docker-compose.qa.yml','playwright.config.ts','HOMOLOGAR_COMPLETO.ps1','IMPLANTAR_APOS_HOMOLOGACAO.ps1')
$fileList = foreach ($item in $items) {
  $p = Join-Path $root $item
  if (Test-Path $p -PathType Container) { Get-ChildItem -LiteralPath $p -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/](node_modules|dist|qa_evidencias|\.git)[\\/]' } }
  elseif (Test-Path $p -PathType Leaf) { Get-Item -LiteralPath $p }
}
$parts = foreach ($file in ($fileList | Sort-Object FullName)) {
  $rel = $file.FullName.Substring($root.Length).Replace('\\','/')
  $sha = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash
  "${rel}:${sha}"
}
$data = [Text.Encoding]::UTF8.GetBytes(($parts -join "`n"))
$h = [Security.Cryptography.SHA256]::Create()
try { $actual = -join ($h.ComputeHash($data) | ForEach-Object { $_.ToString('x2') }) } finally { $h.Dispose() }
if ($actual -ne $qa.sourceFingerprint) { throw 'O codigo mudou desde a homologacao; execute HOMOLOGAR_COMPLETO.ps1 novamente.' }
if (-not (Test-Path '.env')) { throw '.env do ambiente nao encontrado.' }
$envData = @{}
Get-Content '.env' | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') { $envData[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") }
}
foreach ($secret in @('ACCESS_TOKEN_SECRET','REFRESH_TOKEN_SECRET','SEED_ADMIN_PASSWORD')) {
  $value = [string]$envData[$secret]
  if ($value.Length -lt 32 -or $value -match 'change-this|changeme|example|123456') { throw "Configure o segredo seguro $secret no .env antes de implantar." }
}
if ($envData['NODE_ENV'] -ne 'production') { throw 'Defina NODE_ENV=production e configure HTTPS conforme a infraestrutura, antes de uso real.' }
if ([string]$envData['SYSADV_DB_PASSWORD'] -eq 'sysadv_dev' -or ([string]$envData['SYSADV_DB_PASSWORD']).Length -lt 24) { throw 'O PostgreSQL usa senha de desenvolvimento ou SYSADV_DB_PASSWORD ausente. Rotacione-a de forma controlada, antes de implantar dados reais.' }
if (-not ([string]$envData['SYSADV_DATABASE_URL']).StartsWith('postgresql://sysadv:')) { throw 'Configure SYSADV_DATABASE_URL com as credenciais rotacionadas no .env.' }
if (-not $ConfirmarProducao) {
  Write-Host '[OK] Evidencias validas; codigo sem alteracoes; segredos minimos conferidos.'
  Write-Host 'Para aplicar ao sistema principal, execute novamente com -ConfirmarProducao.'
  exit 0
}
Write-Host 'ATENCAO: a atualizacao ira alterar o banco real apos realizar pg_dump, sem migracoes Prisma versionadas.' -ForegroundColor Yellow
Write-Host 'Verifique sua politica de backup de documentos e a capacidade de restauracao.' -ForegroundColor Yellow
& cmd /c 'ATUALIZAR_SISTEMA.bat'
if ($LASTEXITCODE -ne 0) { throw "Falha ao implantar (exit code $LASTEXITCODE). Consulte os logs e nao libere dados reais." }
Write-Host '[OK] Instalador executado. A liberacao final ainda exige aceite funcional/juridico e restore de backup comprovado.'
