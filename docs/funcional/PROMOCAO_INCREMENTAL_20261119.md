# Promocao incremental SysADV - 2026-11-19

## Escopo proposto para a main
Esta entrega reaproveita as tabelas existentes. Nao altera schema Prisma e nao requer migracoes.

- RF-002/004: detalhes dos retornos no atendimento, incluindo proxima data.
- RF-005: filtros de retorno atrasado, futuro e nao agendado; API agregada por escritorio.
- RF-022 (parcial): criacao explicita e idempotente de tarefa de retorno vinculada ao atendimento, com auditoria.
- RF-036 (parcial): roteiro de onboarding local por usuario/navegador (nao configura o sistema nem registra aceite).
- Testes unitarios de politica de acompanhamento, presentes em `follow-up-policy.test.ts`.

## Novas rotas
- `GET /api/intakes/summary` — indicadores com filtro de organizacao autenticada.
- `GET /api/intakes?followUp=OVERDUE|UPCOMING|UNSCHEDULED` — filtros de acompanhamento.
- `POST /api/intakes/:id/follow-up-task` — aproveita `WorkTask` existente, exigindo `intake.write` + `task.write`.
- `/onboarding` — roteiro de primeiros passos acessivel na navegacao.

## Exclusoes intencionais
Nao inclui `CrmOpportunity`, `Diligence`, Assistente IA, parcelamento de honorarios ou alteracoes de ambiente. Essas melhorias ficam na branch `feat/crm-followups-fenalaw-20261119` e PR #1 aguardando testes integrados/migracoes.

## Condicao de qualidade
A promocao na main e de **codigo-fonte somente**, sem declaracao de homologacao ou deploy. Nao ha CI automatizado executado no repositorio no momento desta avaliacao. A versao publica nao deve ser incrementada ate que uma release seja validada e publicada.

Verificacoes necessarias antes de deploy:
```
npm ci
npm run db:generate
npm run test -w @sysadv/api
npm run test -w @sysadv/web
npm run build
```
Alem disso: testar duas organizacoes, permissoes, idempotencia sob concorrencia e interface em dispositivos moveis.