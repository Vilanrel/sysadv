# SysADV v0.10.0-qa2 | Hotfix de homologacao PowerShell 5.1

**Causa:** no `HOMOLOGAR_COMPLETO.ps1` anterior, `$ErrorActionPreference = 'Stop'` combinado com `docker ... 2>&1 | Tee-Object` podia elevar uma mensagem de progresso no stderr (`Image ... Building`) a excecao. A compilacao nao havia terminado, portanto a mensagem nao demonstrava falha de Docker/TypeScript.

**Correcao:** todos os comandos Compose agora passam por `Invoke-QACompose`, que captura stdout e stderr, mostra o progresso, grava logs em `qa_evidencias/<execucao>` e decide o resultado exclusivamente pelo **exit code real**. O tratamento temporario de `Continue` afeta apenas a execucao do Docker e restaura `Stop` no restante do script. O build usa `--progress plain`. Tambem foi corrigida a gravacao de `endedAt` no dicionario de resultado.

**Instalacao:** faca backup de `HOMOLOGAR_COMPLETO.ps1` e substitua-o pelo arquivo do hotfix na pasta `C:\Temp\Sistemas\SysADV`. Nao toque no `.env`, no banco, nem nos volumes. O pacote completo `qa2` contem a mesma correcao.

**Execute no PowerShell:**

```powershell
cd C:\Temp\Sistemas\SysADV
.\HOMOLOGAR_COMPLETO.bat
```

Quando houver erro verdadeiro, a mensagem mostrara o codigo retornado pelo Docker. Leia o log de build:

```powershell
$ultimo = Get-ChildItem .\qa_evidencias -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Get-Content (Join-Path $ultimo.FullName 'build.log') -Tail 90
Get-Content .\qa_evidencias\ULTIMO_RESULTADO.json -Raw
```

**Limites:** a correcao foi validada estaticamente. Docker, PostgreSQL, web e Playwright nao foram executados neste ambiente. A QA continua com status pendente ate que o seu Windows conclua as etapas; nao liberar dados reais nem chamar o instalador de producao antes disso.
