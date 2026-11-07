# Cada execucao gera um novo release AAAAMMDDNN (NN inicia em 01 a cada dia).
# Para consultar sem alterar: .\GERAR_NOVA_VERSAO.ps1 -Simular
# Data YYYYMMDD opcional, para manutencao controlada e testes.
[CmdletBinding()]
param([string]$Data = (Get-Date -Format 'yyyyMMdd'), [switch]$Simular)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if ($Data -notmatch '^[0-9]{8}$') { throw 'Data deve usar AAAAMMDD.' }
[void][datetime]::ParseExact($Data, 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture)
$historyPath = Join-Path $root 'config\release-history.json'
$manifestPath = Join-Path $root 'config\release.json'
$localHistoryPath = Join-Path $root 'config\release-history.local.json'
if (-not (Test-Path $historyPath) -or -not (Test-Path $manifestPath)) { throw 'Metadados de release nao encontrados.' }
$history = @((Get-Content -LiteralPath $historyPath -Raw -Encoding UTF8 | ConvertFrom-Json))
$localHistory = @()
if (Test-Path $localHistoryPath) { $localHistory = @((Get-Content -LiteralPath $localHistoryPath -Raw -Encoding UTF8 | ConvertFrom-Json)) }
$manifest=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$known = @($history) + @($localHistory) + @([PSCustomObject]@{release=$manifest.release})
$matching = @($known | Where-Object { $_.release -match ('^' + $Data + '[0-9]{2}$') })
$last = 0
foreach ($item in $matching) { $last = [Math]::Max($last, [int]([string]$item.release).Substring(8,2)) }
if ($last -ge 99) { throw 'Limite diario de 99 releases atingido.' }
$seq = $last + 1
$next = $Data + $seq.ToString('00')
Write-Host "Proximo release SysADV: $next" -ForegroundColor Cyan
if ($Simular) { Write-Host 'Simulacao concluida; nenhum arquivo alterado.'; exit 0 }

function Write-Utf8NoBom([string]$Path,[string]$Content) {
  [IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}
function Replace-Required([string]$Path,[string]$Pattern,[string]$Replacement) {
  $full=Join-Path $root $Path
  $text=[IO.File]::ReadAllText($full)
  if (-not [regex]::IsMatch($text,$Pattern)) { throw "Marcador de versao nao encontrado em $Path" }
  $updated=[regex]::Replace($text,$Pattern,$Replacement)
  Write-Utf8NoBom $full $updated
}
# Validar marcadores ANTES de gravar a nova versao.
$markers=@(
  @('apps\web\src\app\version.ts',"export const APP_VERSION = '[0-9]{10}';"),
  @('apps\api\src\modules\system\system.routes.ts',"export const SYSTEM_VERSION = '[0-9]{10}';"),
  @('apps\web\index.html','<meta name="sysadv-ui-release" content="[0-9]{10}"'),
  @('package.json','"sysadvRelease"\s*:\s*"[0-9]{10}"'),
  @('scripts\qa\api-acceptance.mjs',"assert.equal\(v.data.version, '[0-9]{10}'\)")
)
foreach ($entry in $markers) {
  $text=[IO.File]::ReadAllText((Join-Path $root $entry[0]))
  if (-not [regex]::IsMatch($text,$entry[1])) { throw "Nao e possivel atualizar a versao: $($entry[0])" }
}
$manifest.release=$next
$manifest.date=$Data.Substring(0,4)+'-'+$Data.Substring(4,2)+'-'+$Data.Substring(6,2)
$manifest.sequence=$seq
Replace-Required 'apps\web\src\app\version.ts' "export const APP_VERSION = '[0-9]{10}';" ("export const APP_VERSION = '"+$next+"';")
Replace-Required 'apps\api\src\modules\system\system.routes.ts' "export const SYSTEM_VERSION = '[0-9]{10}';" ("export const SYSTEM_VERSION = '"+$next+"';")
Replace-Required 'apps\web\index.html' '(<meta name="sysadv-ui-release" content=")[0-9]{10}("\s*/>)' ('${1}'+$next+'${2}')
Replace-Required 'package.json' '"sysadvRelease"\s*:\s*"[0-9]{10}"' ('"sysadvRelease": "'+$next+'"')
Replace-Required 'scripts\qa\api-acceptance.mjs' "assert.equal\(v.data.version, '[0-9]{10}'\)" ("assert.equal(v.data.version, '"+$next+"')")
Write-Utf8NoBom $manifestPath (($manifest | ConvertTo-Json -Depth 6)+"`n")
$newRecord=[PSCustomObject]@{release=$next;date=$manifest.date;sequence=$seq;note='Nova release gerada pelo script'}
$history += $newRecord
$localHistory += $newRecord
Write-Utf8NoBom $historyPath ((ConvertTo-Json -InputObject @($history) -Depth 6)+"`n")
Write-Utf8NoBom $localHistoryPath ((ConvertTo-Json -InputObject @($localHistory) -Depth 6)+"`n")
Write-Host "[OK] Release $next sincronizada no frontend, API, manifesto e testes." -ForegroundColor Green
Write-Host 'Execute TESTAR_BUILD_SEM_INSTALAR.bat antes de publicar. O banco nao foi modificado.'
