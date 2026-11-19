# SysADV — Implementacao Fenalaw 2026 — Entrega incremental para homologacao posterior

Data-base: 2026-11-19. Branch: `feat/crm-followups-fenalaw-20261119`.

## Matriz dos 36 requisitos (referencia funcional)
Legenda: EXISTENTE = ja presente na main; NOVO PARCIAL = codigo incluido nesta branch;
PENDENTE = fora do escopo implementado; VALIDAR = presente mas sem evidencia de homologacao.

| IDs | Situacao em codigo | Observacao |
|---|---|---|
| RF-001 a RF-002 | EXISTENTE | pessoas e atendimentos |
| RF-003 a RF-004 | NOVO PARCIAL | filtros e visualizacao do CRM; funil e historico omnicanal pendentes |
| RF-005 | NOVO PARCIAL | criacao manual de tarefa vinculada ao retorno; envio e execucao automatica pendentes |
| RF-006 a RF-008 | EXISTENTE | processos, movimentos, agenda |
| RF-009 a RF-011 | VALIDAR | prazos, alertas e integracoes; dependencia de credenciamento e calendarios |
| RF-012 a RF-014 | EXISTENTE | documentos e modelos |
| RF-015 a RF-016 | NOVO PARCIAL | rascunho/revisao textual opt-in; sem protocolo e sem revisao automatica de fontes |
| RF-017 a RF-018 | PENDENTE | verificacao de jurisprudencia e de citacoes nao automatizada |
| RF-019 a RF-020 | EXISTENTE | tarefas e Kanban |
| RF-021 a RF-022 | NOVO PARCIAL | gatilho MANUAL para tarefa de retorno, nao motor generico de workflows |
| RF-023 | PENDENTE | correspondentes e diligencias |
| RF-024 a RF-026 | EXISTENTE | financeiro, honorarios, timesheet |
| RF-027 | NOVO PARCIAL | parcelamento de honorarios fixos ativos; sem boleto, gateway ou liquidacao |
| RF-028 a RF-029 | VALIDAR | indicadores e integracoes condicionadas |
| RF-030 a RF-031 | PENDENTE | pesquisa patrimonial e fluxo especializado |
| RF-032 a RF-033 | VALIDAR | permissoes/tenant; verificacao multi-organizacao com PostgreSQL necessaria |
| RF-034 a RF-036 | PENDENTE | comercializacao modular e onboarding |

## Contratos e novos endpoints
- `GET /api/intakes/summary` — indicadores isolados por escritorio autenticado.
- `GET /api/intakes?followUp=OVERDUE|UPCOMING|UNSCHEDULED` — filtro de retornos.
- `POST /api/intakes/:id/follow-up-task` — cria uma tarefa por atendimento e devolve a existente em chamada repetida; requer `intake.write` e `task.write`.
- `GET /api/legal-ai/status` — estado da integracao de IA e necessidade de revisao.
- `POST /api/legal-ai/drafts` — gera texto apenas com dados explicitamente informados, sem persistir ou protocolar. Requer `document.generate` e consentimento na interface.
- `POST /api/agreements/:id/installments` — cria de 1 a 60 contas a receber mensais a partir de honorarios FIXED/ACTIVE. Bloqueia repeticoes com lock transacional e marcador de plano. Requer `contract.manage` e `finance.manage`.

## Regras inegociaveis antes da ativacao
1. Sem merge automatico na main e sem deploy.
2. Sem chamadas externas automaticas judiciais, cobrança ou peticionamento.
3. IA desabilitada por padrao; chave apenas no servidor/secret manager e autorizacao de tratamento de dados.
4. Dados sempre isolados por `organizationId` da autenticacao.
5. Parcelamento cria lancamentos contabeis internos, nao realiza pagamentos.
6. Incluir testes reais de schema Prisma, build API/Web, teste API/PostgreSQL, duas organizacoes, responsividade e homologacao funcional.
7. Na geracao de parcelas, validar concorrencia e contrato com valores/limites reais, calculos de centavos e calendario mensal.
8. Validar politica de privacidade e demonstrar ausencia de transferencia de dados ao provedor de IA quando desabilitado.

## Comandos de verificacao apos obter a branch em ambiente controlado
```bash
npm ci
npm run db:generate
npm run test -w @sysadv/api
npm run test -w @sysadv/web
npm run build
```

Nenhum desses comandos foi executado pela interacao remota atual.
A homologacao integrada e a liberacao de producao serao executadas em etapa separada.
