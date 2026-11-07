# SysADV v0.10.1-qa5 — Hotfix TS2345 doubleBasis

## Diagnostico
O QA4 corrigiu a propriedade `city`, mas os endpoints `POST /deadlines/preview` e `POST /deadlines` continuam a enviar `doubleBasis` com o tipo `DoubleBasis | undefined` ao metodo `prepare` que exige `DoubleBasis`.

## Correcao
- O envio para `prepare` agora utiliza `doubleBasis: data.doubleBasis ?? 'NONE'`, exclusivamente apos validacao pelo schema Zod.
- A gravacao do rascunho usa `p.calcInput.doubleBasis`, o mesmo valor utilizado pelo motor de calculo.
- Sem alteracoes no banco, calendarios, API publica ou migracoes.
- A omissao do parametro significa **sem prerrogativa**, nunca concede prazo em dobro automaticamente.

## Aplicar
1. Extraia o ZIP em `C:\Temp\Sistemas\SysADV` (deve criar `_hotfix_qa5`).
2. No PowerShell, execute `.\_hotfix_qa5\APLICAR_HOTFIX_QA5.bat` dentro da pasta do projeto.
3. Execute `.\HOMOLOGAR_COMPLETO.bat` e confira `qa_evidencias`.

O script confere SHA-256, faz backup e recusa instalar sobre arquivos diferentes da base QA4.

## Limitacoes
Esta revisao foi inspecionada e testada estaticamente. A compilacao completa TypeScript, Docker, PostgreSQL e navegacao autenticada nao foram executadas pelo assistente. Nao utilizar com prazos reais antes da homologacao juridica e tecnica.
