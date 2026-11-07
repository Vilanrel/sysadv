# SysADV v0.10.1-qa4 - Correcoes de build dos prazos

Origem: v0.10.1-qa3. O arquivo de log do Windows apontou TS2322 e TS2345 no modulo `deadlines.routes.ts`.

Mudancas:
- `city` e normalizado a uma string antes de usar chaves de banco, preparar a previa ou salvar o prazo.
- O motor preserva a revisao juridica: cidade ausente ou em branco nao permite cobertura municipal homologada.
- O frontend explica por que uma cidade sem validacao bloqueia a aprovacao.
- Adicionados dois casos de regressao ao conjunto de testes da engine.

Aplicacao do hotfix (recomendado): extraia o ZIP **na raiz do SysADV** e execute `._hotfix_qa4\APLICAR_HOTFIX_PRAZOS.bat` (veja instrucao abaixo).
Comando correto no PowerShell: ` .\_hotfix_qa4\APLICAR_HOTFIX_PRAZOS.bat `.

O instalador confere o SHA-256 dos quatro arquivos antes de altera-los e aborta se houver alteracoes nao reconhecidas.
Faz backup individual em `backups_hotfix_qa4/<timestamp>/` e restaura em caso de erro de copia.
Nao altera `.env`, volumes Docker, tabelas ou registros PostgreSQL.

**Testes realizados fora do Docker:** 22 testes da engine passaram; 155 arquivos TS/TSX/JS analisados sem erros de parsing; 6 verificacoes especificas de codigo passaram.
**Nao realizados neste ambiente:** `npm install`, `tsc` semantico, build Docker/Vite, integracao PostgreSQL e homologacao de interface autenticada.

**Reiniciar homologacao:** apos aplicar o hotfix, ` .\HOMOLOGAR_COMPLETO.bat ` com o Docker Desktop/WSL disponiveis.
Nao implantar em producao ate a homologacao completa.
