# SysADV — Situacao consolidada dos 36 requisitos — 19/11/2026

## Contexto
Reconciliacao realizada a partir da main (merge PR #2). A nova branch de desenvolvimento
conta com PR #3 e **nao foi mesclada nem publicada em Railway**.

## Estado por frente
| RF | Cobertura registrada em codigo | Faltas antes do aceite |
|---|---|---|
| 001-002 | Base anterior na main | Homologar |
| 003 | Funil de oportunidades, CRUD, relacao com clientes, tela /crm | Migracao Prisma + integracao E2E |
| 004 | Atendimentos e relacionamentos na base | Historico omnicanal pendente |
| 005 | Filtros de retorno e tarefas idempotentes na main | Disparos externos pendentes |
| 006-009 | Processos, movimentacoes, agenda e motor de prazos anteriores | Testes juridicos por materia/tribunal |
| 010-011 | Alertas internos e conectores judiciais anteriores | Notificacoes externas e homologacao dos tribunais |
| 012-014 | Documentos, modelos e PDF/DOCX anteriores | Testes de permissao e geracao |
| 015-016 | Assistente IA opt-in com revisao obrigatoria, tela /legal-ai | Provedor configurado, QA juridica e politicas de dados |
| 017-018 | Triagem de referencias e marcacao PENDING_VERIFICATION | Pesquisa em fonte oficial e confirmacao por humano |
| 019-020 | Tarefas e Kanban anteriores | Testes E2E |
| 021-022 | WorkflowRule/Run, eventos de atendimento, regras desativadas por padrao | Migracao, testes de concorrencia, editor avancado |
| 023 | Diligencias + pessoa com papel CORRESPONDENT | Aceite externo, documentos, notificacoes |
| 024-026 | Financeiro, honorarios e timesheet anteriores | Testes de conciliacao |
| 027 | Parcelamento de honorarios fixos ativos, com auditoria | Testes de concorrencia e bancos |
| 028-029 | Relatorios e integracoes anteriores | Indicadores avancados e credenciais oficiais |
| 030 | Solicitacao patrimonial com base legal/autorizacao/evidencia | Conectores licenciados/autorizados (nenhuma busca automatica) |
| 031 | Fluxo existente de processos e diligencias | Especializar execucao e fases processuais |
| 032-033 | Autenticacao, perfis e auditar anteriores | Testes de tenant e LGPD |
| 034 | Catalogo preliminar de planos e modulos, sem preco | Precificacao, contratos e checkout |
| 035 | Sem enforcement por assinatura | Direito de uso modular e pagamento seguro pendentes |
| 036 | Roteiro inicial de onboarding na main | Persistencia no backend e conclusao verificada |

## Migracoes versionadas — NENHUMA APLICADA
- 202611190001_fenalaw_crm_diligences
- 202611190002_workflow_rules
- 202611190003_notification_inbox
- 202611190004_asset_research

**Bloqueio:** a main original nao possuia historico de migracoes; precisa de baseline
de banco real em QA antes de qualquer deploy. Guia: docs/db/BASELINE_E_MIGRACOES_FENALAW_20261119.md.

## Status de testes e liberacao
- Criada acao manual .github/workflows/sysadv-manual-validation.yml
- Nenhuma compilacao ou teste PostgreSQL/CI executado pelo assistente.
- Sem alteracao em main (alem do PR #2 anterior), Railway, PostgreSQL ou production.
- Novas APIs so devem ser disponibilizadas apos migracoes e verificacao de isolamento.

## Proximos marcos
1. Gerar baseline completa e migracoes efetivas em QA isolado com restauracao validada.
2. Executar testes unitarios, builds e testes integrados multi-organizacao.
3. Implantar adaptadores de notificacao externa com credenciais e auditoria.
4. Homologar workflows, IA juridica, financeiro e fontes de pesquisa autorizadas.
5. Implementar assinaturas e controle seguro de habilitacao por escritorio.
6. Gerar release no formato AAAAMMDDNN somente apos QA e aceite.

## Avanco do marco de QA — GitHub Actions

- PR #4 incorporou **somente** o workflow de QA manual a `main`, sem executa-lo.
- O fluxo agora pode ser selecionado em `Actions > SysADV - QA manual isolado > Run workflow`, com branch `feat/fenalaw-reconciled-20261119`.
- A execucao prevista inicia PostgreSQL 16 efemero, aplica DDL da baseline v0.10.1, marca a baseline no historico Prisma, aplica os quatro incrementos, verifica drift e roda smoke multiorganizacao. As escritas de smoke tem trava de ambiente QA e base `sysadv_qa`.
- **Nao houve execucao e nao ha logs que comprovem sucesso.** Nao classificar como homologado.
- PR #3 foi sincronizado com a `main` apos o merge da PR #4, preservando todo o trabalho em desenvolvimento.
