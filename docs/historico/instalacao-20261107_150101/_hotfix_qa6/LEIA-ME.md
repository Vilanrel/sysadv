# SysADV v0.10.1-qa6 — Correção TS2345 na API

## Causa
Após QA5, TypeScript passou a acusar `internalBusinessDays: number | undefined` ao chamar `prepare` nas linhas 136 e 141 de `deadlines.routes.ts`. O campo possui `.default(2)` no Zod, mas a assinatura genérica de `validated<T>(schema: z.ZodType<T>)` não preservava de maneira precisa o tipo de saída pós-parse.

## Correção
O validador compartilhado agora recebe um schema genérico `TSchema extends z.ZodTypeAny` e devolve `z.output<TSchema> | null`, espelhando a saída de `schema.safeParse(input)`. Os defaults configurados no Zod são considerados obrigatórios após validação. Mantidas as validações e o comportamento do campo `internalBusinessDays` (valor padrão 2, faixa permitida de 0 a 20), bem como `city` e `doubleBasis`. Não houve alteração das regras jurídicas nem de banco.

## Aplicação
1. O pacote QA5 deve estar aplicado.
2. Extraia este ZIP sobre `C:\Temp\Sistemas\SysADV`, criando `_hotfix_qa6`.
3. Rode `./_hotfix_qa6/APLICAR_HOTFIX_QA6.bat` no PowerShell com o ponto-e-barra inicial: `.\_hotfix_qa6\APLICAR_HOTFIX_QA6.bat`.
4. Rode `.\HOMOLOGAR_COMPLETO.bat`.

O aplicador exige SHA-256 esperado, guarda o original em `backups_hotfix_qa6`, é repetível e não altera `.env`, arquivos ou dados PostgreSQL.

## Evidências e limites
- Testes do motor: 22/22 passaram no ambiente local.
- TypeScript: revisão sintática e contrato de validação, não build integral (instalação de dependências indisponível neste ambiente por erro de rede `EAI_AGAIN`; Docker não disponível).
- PostgreSQL, API e frontend: homologação real ainda pendente.
- Não habilitar cálculo de prazos reais antes de revisão jurídica e validação dos calendários.

Hashes SHA-256 do arquivo:
- anterior: `98CB02EFE09BA0DC0976BAB45ECAC7E3EB1EA9D227550F1D1A0BD3CB45B87DF6`
- corrigido: `6D9EF2A89B90D85207B77C112C86672793C827171DC5E7A81DC1A6B4C7A32280`
