# SysADV v0.9.2-r2 — pacote completo e reparo definitivo do Compose

Data de preparacao: 06/11/2026. Base: codigo completo da v0.9.2-r1.

## Causa e resolucao

O arquivo `docker-compose.yml` da primeira v0.9.2 continha uma segunda declaracao de `sysadv-judicial-worker` na linha 51. A v0.9.2-r1 corrigiu o arquivo distribuido, mas a falha `go-yaml ... L1.C1-L51.C2: did not find expected key` indica que a copia local do usuario ainda pode estar desatualizada, danificada ou ter sido editada com recuo incorreto. Sem acesso a copia local, nao e possivel afirmar a causa exata.

Esta release inclui:

- `docker-compose.yml` reescrito e validado com parser YAML rigoroso (sem chave duplicada), preservando os quatro servicos e os volumes nomeados.
- `config/docker-compose.v0.9.2-r2.yml` como copia canonica.
- `REPARAR_COMPOSE.bat`: faz backup do compose local em `backups/config/` antes de restaurar a copia canonica; nao altera `.env`, PostgreSQL ou volumes.
- `ATUALIZAR_SISTEMA.bat`: testa apenas `docker-compose.yml` com `-f` explicito, impede seguimento de configuracao invalida e explica a acao corretiva.
- `VERIFICAR_COMPOSE.bat`: verifica o arquivo antes da atualizacao.
- Mantem a versao interna da API em `0.9.2`; `-r2` identifica a revisao do pacote, nao uma nova migracao.

## Instalar no Windows / PowerShell

1. Faca backup do projeto e do banco. **Nao** execute `docker compose down -v`.
2. Extraia o conteudo deste ZIP diretamente na pasta real `C:\Temp\Sistemas\SysADV`, marcando a substituicao de todos os arquivos existentes. O ZIP nao contem `.env` nem backup de banco e nao remove volumes.
3. Na pasta do projeto execute:

```powershell
cd C:\Temp\Sistemas\SysADV
.\REPARAR_COMPOSE.bat
.\VERIFICAR_COMPOSE.bat
.\ATUALIZAR_SISTEMA.bat
```

> IMPORTANTE: `REPARAR_COMPOSE.bat` substitui o Compose local pelo layout padrao da release. Antes, salva uma copia em `backups/config/`. Se voce personalizou servicos/portas/credenciais no compose, revise a copia anterior e reaplique alteracoes necessarias de forma compativel. O script nao altera o `.env`.

Se voce descompactou o ZIP em uma subpasta, por exemplo `SysADV\SysADV_v0.9.2-r2\`, o executavel instalado continuara lendo o compose antigo. Confira a presenca de `config\docker-compose.v0.9.2-r2.yml` junto ao `.bat` e ao compose, na **mesma pasta raiz** da instalacao.

### Instalacao explicita usando PowerShell

Ajuste o caminho de Downloads conforme o arquivo baixado:

```powershell
$destino = 'C:\Temp\Sistemas\SysADV'
$pacote = Join-Path $env:USERPROFILE 'Downloads\SysADV_v0.9.2-r2_Integracoes_Judiciais_Completo_Corrigido.zip'
Expand-Archive -LiteralPath $pacote -DestinationPath $destino -Force
Set-Location $destino
.\REPARAR_COMPOSE.bat
.\VERIFICAR_COMPOSE.bat
.\ATUALIZAR_SISTEMA.bat
```

**Importante**: `Expand-Archive` pode substituir arquivos do projeto; antes de executar, tenha o backup e verifique que `$destino` aponta a instalacao correta.

## Homologacao e limites

O pacote foi validado estaticamente e por testes offline disponiveis. Nao foi executada uma atualizacao Docker/Prisma real no computador do usuario. A preservacao dos volumes depende de manter a instalacao e projeto Docker atuais. As integracoes judiciais continuam sujeitas a contrato, credenciais, autorizacoes e homologacao; nao ha liberacao automatica para DataJud comercial, ciencia ou peticionamento.
