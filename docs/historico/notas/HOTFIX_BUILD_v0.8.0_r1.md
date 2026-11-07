# SysADV v0.8.0 - hotfix r1 de compilacao web

## Problema
O frontend falhava no build com TypeScript TS2552 em `apps/web/src/features/templates/DocumentTemplatesPage.tsx` linha 165: `Cannot find name 'selectedBlockIds'`.

## Correcao
A rotina `generate()` agora mapeia a propriedade da API `selectedBlockIds` para o estado React `selectedBlocks`, exatamente como a rotina de pre-visualizacao.

## Arquivos modificados
- `apps/web/src/features/templates/DocumentTemplatesPage.tsx`: substituicao pontual na carga JSON da geracao.
- `scripts/tests/v080-template-generation-contract.test.mjs`: teste de regressao da carga de geracao.

## Testes no ambiente de preparacao
- 28 testes `node --experimental-strip-types --test scripts/tests/*.test.mjs`: aprovados.
- `node scripts/verify-v080.mjs`: 9/9.
- `node scripts/verify-release.mjs`: 32 verificacoes.
- `node scripts/check-esm-imports.mjs`: aprovado.
- **Build completo npm/Docker nao executado**: dependencias nao disponiveis localmente e npm nao conseguiu acessar o registry (EAI_AGAIN). Requer validacao com build real em maquina que tenha as dependencias.

## Aplicacao
Extraia o ZIP na pasta do projeto, substituindo os arquivos do codigo-fonte, sem sobrescrever o seu arquivo `.env`. No Windows, a partir de `C:\Temp\Sistemas\SysADV`, rode `ATUALIZAR_SISTEMA.bat` apos backup. O script atualiza schema e seed; em producao avalie o schema antes de rodar e garanta backup do PostgreSQL. Nao use `docker compose down -v`.

## Alternativa para corrigir somente o erro, sem substituir o pacote
Edite a linha 165 do arquivo citado, trocando apenas `selectedBlockIds,` por `selectedBlockIds:selectedBlocks,` na chamada a `/generate`, e execute `docker compose build --no-cache sysadv-web` para validar o frontend.
