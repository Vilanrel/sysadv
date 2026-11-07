# Remove SOMENTE o projeto efemero informado; nunca toca no projeto sysadv.
# Previa: .\REMOVER_AMBIENTE_QA.ps1
# Remocao: .\REMOVER_AMBIENTE_QA.ps1 -Executar
[CmdletBinding()]
param(
  [string]$Projeto = 'sysadvqa1107135812',
  [switch]$Executar,
  [switch]$ExcluirVolumesQA,
  [switch]$ExcluirImagensQA
)
$ErrorActionPreference = 'Stop'
if ($Projeto -cnotmatch '^sysadvqa[0-9]{10}$') {
  throw 'Projeto QA invalido. Permitido somente sysadvqa + 10 digitos; sysadv e protegido.'
}
if ($Projeto -eq 'sysadv') { throw 'Proibido operar sobre o ambiente principal.' }

function Docker-Lista {
  param([string[]]$ArgsList)
  $saved = $ErrorActionPreference
  try { $ErrorActionPreference='Continue'; $value = @(& docker @ArgsList 2>&1); $code=$LASTEXITCODE }
  finally { $ErrorActionPreference=$saved }
  if ($code -ne 0) { throw "Docker falhou: $($ArgsList -join ' ') - $($value -join ' ')" }
  return @($value | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().Length -gt 0 })
}

# Usar labels de Compose evita qualquer dependencia de .env e do Compose QA.
$server = Docker-Lista @('version','--format','{{.Server.Version}}')
$principal = @(Docker-Lista @('ps','-a','--filter','label=com.docker.compose.project=sysadv','--format','{{.Names}}'))
$containers = @(Docker-Lista @('ps','-a','-q','--filter',("label=com.docker.compose.project="+$Projeto)))
$networks = @(Docker-Lista @('network','ls','-q','--filter',("label=com.docker.compose.project="+$Projeto)))
$volumes = @(Docker-Lista @('volume','ls','-q','--filter',("label=com.docker.compose.project="+$Projeto)))
$images = @()
if ($ExcluirImagensQA) {
  $images = @(Docker-Lista @('image','ls','--format','{{.Repository}}:{{.Tag}}') | Where-Object {
    $_ -like ($Projeto + '-*') -and $_ -notmatch '<none>'
  })
}
Write-Host "Docker Engine: $($server -join ', ')"
Write-Host "Projeto principal preservado: sysadv ($($principal.Count) conteineres)" -ForegroundColor Green
Write-Host "QA alvo exato: $Projeto" -ForegroundColor Cyan
Write-Host "Containers QA: $($containers.Count); redes QA: $($networks.Count); volumes QA: $($volumes.Count); imagens QA selecionadas: $($images.Count)"
if ($principal.Count -eq 0) { Write-Warning 'Nao foram localizados conteineres do projeto sysadv. Nenhum container principal sera alterado.' }
if (-not $Executar) {
  Write-Host 'MODO PREVIA. Nada removido. Para executar: .\REMOVER_AMBIENTE_QA.bat'
  exit 0
}
foreach ($id in $containers) { [void](Docker-Lista @('container','rm','-f',$id)) }
foreach ($id in $networks) { [void](Docker-Lista @('network','rm',$id)) }
if ($ExcluirVolumesQA) {
  foreach ($id in $volumes) { [void](Docker-Lista @('volume','rm',$id)) }
} else {
  Write-Host 'Volumes QA mantidos por seguranca. Opcao: -ExcluirVolumesQA (DESTRUTIVA, somente QA).'
}
if ($ExcluirImagensQA) {
  foreach ($id in $images) { [void](Docker-Lista @('image','rm',$id)) }
}
$remaining = @(Docker-Lista @('ps','-a','-q','--filter',("label=com.docker.compose.project="+$Projeto)))
if ($remaining.Count -gt 0) { throw "Ainda ha $($remaining.Count) conteineres QA." }
Write-Host "[OK] Ambiente QA $Projeto removido. Projeto principal sysadv nao foi alterado." -ForegroundColor Green
Docker-Lista @('ps','-a','--filter','label=com.docker.compose.project=sysadv','--format','table {{.Names}}\t{{.Status}}') | Out-Host
