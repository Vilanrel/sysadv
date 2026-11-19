# SysADV - Onda 1: evolucao incremental do CRM juridico

## Escopo implantado nesta branch
- RF-003/RF-004 (parcial): listagem e acompanhamento de atendimentos no CRM existente, sem entidade duplicada.
- RF-005 (parcial): filtros de retornos vencidos, agendados e sem agenda, utilizando `OfficeIntake.nextContactAt`.
- GET `/api/intakes/summary`: contadores `overdue`, `upcoming`, `unscheduled`, `converted` e `asOf`, sempre isolados por `organizationId` autenticado.
- GET `/api/intakes?followUp=OVERDUE|UPCOMING|UNSCHEDULED`: filtro independente de novos campos do banco.
- A interface `/intakes` permite filtrar retornos e consultar a data agendada em cada linha.
- Testes unitarios para regra de acompanhamento e segregacao por organizacao.

## Criterios de aceite
1. A contagem em `/api/intakes/summary` ignora atendimentos encerrados e convertidos na soma de retornos.
2. `OVERDUE` inclui apenas datas anteriores ao instante de consulta.
3. `UPCOMING` inclui datas iguais ou futuras ao instante de consulta.
4. `UNSCHEDULED` inclui apenas atendimentos ativos com `nextContactAt IS NULL`.
5. Nenhuma consulta usa `organizationId` informado pelo navegador.
6. A tela continua permitindo criar/editar atendimentos e vincular processos.
7. Teste de permissao: usuario sem `intake.read` recebe 403 no resumo e na listagem.

## Nao incluido nesta onda
- Funil de oportunidades, historico unificado de relacionamento e execucao automatica de follow-ups.
- IA juridica e validacao de citacoes; orquestrador de workflows; cobranca recorrente.
- Pesquisa patrimonial, correspondentes, planos comerciais e onboarding.

## Gate obrigatorio antes de main e producao
- `npm ci`, `npm run db:generate`, `npm run test -w @sysadv/api`, `npm run build`.
- Testes integrados de API com PostgreSQL e isolamento entre duas organizacoes.
- Capturas da interface `/intakes` em 390px e 1440px e aceite funcional.
- Sem alteracao no schema Prisma; nenhum `db push` ou migracao de producao necessario nesta onda.

**Status**: codigo submetido para revisao. Testes nao executados nesta sessao por ausencia de acesso direto ao clone/dependencias.