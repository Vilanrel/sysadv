# SysADV v0.10.0 — escopo verificado em código

## Origem

A entrada `Pacote_Levantamento_Projuris_ADV.zip` registra 283 títulos, 55 seções e 13 módulos; seu manifesto ressalta que **os textos integrais, screenshots, GIFs e contratos de integração não foram incorporados**. A imagem do usuário apresenta módulos e uma linguagem visual a perseguir. A arquitetura usada é a v0.9.2-r5 com PostgreSQL/Prisma, Node Fastify e React.

## Correspondência com o painel ilustrado

| Tela apresentada | Caminho no SysADV | Implementação na v0.10.0 | Situação |
|---|---|---|---|
| Dashboard | `/` | Indicadores reais + visão de escritório com escopo por permissão | Código, sem homologação de banco |
| Clientes | `/people` | Cadastro, filtros, papéis e vínculos | Herdado da v0.9.2-r5 |
| Processos | `/processes` e `/processes/:id` | Listagem, edição, detalhes, histórico | Herdado da v0.9.2-r5 |
| Agenda | `/agenda` | Agenda e audiências | Herdado da v0.9.2-r5 |
| Publicações | `/publications` | Publicações, triagem e vinculação | Herdado da v0.9.2-r5 |
| Tarefas/Kanban | `/tasks`, `/kanban` | Atribuição, checklist, quadro e prazos | Herdado da v0.9.2-r5 |
| Atendimentos | `/intakes` | Cadastro, edição, estados, clientes e processos | Novo código |
| Financeiro | `/finance` | Lançamentos, vencimento, baixa parcial, saldo, cancelamento auditado | Novo código |
| Contratos de honorários | `/agreements` | Tipos fixo, hora e êxito, vigência, cliente, vínculo | Novo código |
| Timesheet | `/timesheets` | Apontamentos, cronômetro auxiliar, aprovação por permissão | Novo código |
| Integrações judiciais | `/integrations` | Políticas e conectores da v0.9.2 | Herdado, condicionado à homologação |
| Relatórios | `/reports` | KPIs e 6 exportações CSV autorizadas | Novo código |
| Administração | `/admin`, `/users`, `/settings`, `/audit` | Centro administrativo, contas, trilha e parâmetros | Parcial novo/herdado |
| Detalhe do processo | `/processes/:id` | Dados e histórico por processo | Herdado |

## Segurança e negócio

- Todas as novas rotas estão protegidas por `authenticate` e `requirePermission` e usam `organizationId` do token validado no backend, nunca do corpo de requisição.
- Referências de clientes, processos, contratos, tarefas e atendimentos verificam a organização antes de gravar.
- Financeiro armazena valores inteiros em centavos e as baixas em registros separados. Um pagamento possui `Idempotency-Key` e a regra impede ultrapassar o saldo disponível. A consistência sob concorrência exige homologação PostgreSQL, ainda não realizada. Conflitos de concorrência retornam erro para reconciliação manual.
- Auditoria do PostgreSQL registra as mutações com ator, organização, entidade, situação anterior e nova.
- CSV tem controle por módulo e escape contra CSV injection. Não equivale a relatórios contábeis homologados.
- Nenhuma integração faz ciência eletrônica oficial, peticionamento ou liquidação bancária sem credenciais e autorização.

## Limites

A navegação está conectada ao código; porém o catálogo anexado não permite afirmar que os 283 fluxos de referência foram implementados integralmente. Ainda são necessários: testes compilados Docker/Vite, testes integrados com PostgreSQL, testes autenticados multi-tenant e homologação do usuário. A matriz CSV anexa indica cobertura **por módulo**, sem equivalência funcional comprovada artigo a artigo.
