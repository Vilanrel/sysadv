# Base de dados SysADV — reconciliacao e migracoes Prisma

**Estado:** migracoes versionadas, **NAO executadas**. Nunca aplicar diretamente em PR ou main sem QA.

## Diagnostico
A `main` anterior mantinha `prisma/schema.prisma`, mas nao continha historico `prisma/migrations`.
A release 2026110701 tinha esquema persistido e possivel divergencia de DDL; por isso, iniciar
`prisma migrate deploy` cegamente pode produzir drift ou indisponibilidade.

## Migracoes incrementais preparadas
- `202611190001_fenalaw_crm_diligences`: CrmOpportunity, Diligence e seus enums.
- `202611190002_workflow_rules`: WorkflowRule, WorkflowRun e seus enums.
- `202611190003_notification_inbox`: NotificationInbox.
- `202611190004_asset_research`: AssetResearchRequest e enum de status.

**Essas migracoes pressupõem todas as tabelas do SysADV v0.10.1 preexistentes.** Um banco vazio
nao pode ser criado apenas com essas tres migracoes. Para um banco novo, gerar uma baseline
integral do schema anterior e registrar essa baseline antes de aplicar os incrementos.

## Procedimento de QA e restauracao
1. Criar backup verificavel com `pg_dump --format=custom --no-owner` e registrar checksum SHA-256.
2. Restaurar em PostgreSQL QA isolado. Validar contagem de registros, constraints, enums e FKs.
3. Comparar esquema real com a baseline anterior usando `prisma migrate diff`.
4. Criar baseline a partir do schema antigo. Para base existente, marcar baseline como aplicada
   com `prisma migrate resolve --applied <identificador_da_baseline>`; para base nova, aplicar
   realmente o DDL da baseline. Nao usar `db push` neste fluxo.
5. Executar `prisma migrate deploy` **somente em QA** para os quatro incrementos.
6. Executar `prisma validate`, `prisma generate`, build, testes integrados multi-organizacao,
   concorrencia, rollback de transacoes e verificacao das FKs.
7. Comparar registros e auditar alteracoes. Simular restauracao completa.
8. Somente depois programar janela de manutencao para PRD, com backup e rollback.

## Requisitos adicionais
- Nao executar `prisma db push` na mesma base que recebe migracoes.
- Nao rodar `prisma migrate dev` em producao.
- Nao promover schema novo sem que a API correspondente esteja pronta e vice-versa.
- `WorkflowRule.enabled=false` por padrao e `LEGAL_AI_ENABLED=false` por padrao.
- Novas regras do motor de tarefas nao enviam mensagens nem acionam sistemas judiciais.
- Mesmo com acesso de administracao, validacoes de tenant nunca aceitam organizationId do corpo.
