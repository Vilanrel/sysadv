# Matriz de implementação — SysADV v0.9.0

Referência: **Especificação Funcional SysADV v1.0** e matriz de rastreabilidade anexadas pelo solicitante. A situação abaixo diz respeito **somente** à implementação incremental da v0.9.0, sobre a base v0.8.1, sem considerar todos os requisitos anteriores como homologados.

Legenda: **Impl.** = existe implementação de código da funcionalidade descrita; **Parcial** = existe somente parte do fluxo; **Pendente** = não entregue neste ciclo. Todos os itens são **candidatos a homologação** até execução do build completo + testes de banco e interface.

| Requisito | Status | Evidência e lacuna |
|---|---|---|
| RF-PES-001 cadastro único | Impl. | Person, papel múltiplo, CPF/CNPJ validado, vinculação de processos, API tenant-scoped e tela Pessoas. |
| RF-PES-002 cadastro rápido/completo | Parcial | Cadastro simples e formulário avançado; máscaras de entrada e responsáveis de contato são futuras melhorias. |
| RF-PES-003 relacionamento e histórico | Parcial | Vínculos processuais e trilha de auditoria; faltam atendimentos, financeiro e visão unificada de documentos. |
| RF-PES-004 unificação de duplicados | Pendente | Requer análise assistida de duplicidades e migração controlada de vínculos. |
| RF-PES-005 inativação/exclusão | Parcial | Inativação auditada preserva vínculos; exclusão governada ainda não implementada. |
| RF-TAR-001 tarefa e responsável | Parcial | Cadastro, atribuição, prioridades, datas/status; SLA institucional e vínculo a atendimentos pendentes. |
| RF-TAR-002 checklist | Parcial | Itens obrigatórios, data/autor da conclusão, bloqueio de finalização; dependências entre itens não implementadas. |
| RF-TAR-003 ações em lote | Pendente | Reatribuição/exportação em lote não implementadas. |
| RF-TAR-004 origem contextual | Parcial | Criação idempotente por publicação oficial; intimações/andamentos/workflows exigem novas integrações. |
| RF-TAR-005 painel por responsável | Parcial | Filtros por atribuição e vencimento; agregações por equipe e SLA a aprimorar. |
| RF-KAN-001 quadros/colunas | Parcial | Criação e inclusão de colunas; reordenação e quadros por equipe ainda faltam. |
| RF-KAN-002 movimentação visual | Impl. | Arrastar, seletor acessível, mudança de status e trilha de auditoria; suporte a transferência entre quadros. |
| RF-KAN-003 filtros/favoritos | Parcial | Seleção de quadro e filtro minhas tarefas; faltam favoritos e filtros completos. |
| RF-KAN-004 checklist e documentos | Parcial | Checklist contado no cartão; documento anexo contextual não implementado. |
| RF-AGE-001 agenda unificada | Parcial | Eventos, tarefas e feriados, modos dia/semana/mês, escopo organização; filtro por responsável na API, faltam controles de seleção na interface. |
| RF-AGE-002 audiências | Parcial | Processo, local/link, início/fim, responsável, histórico auditado; modalidade, participantes e notificações faltam. |
| RF-AGE-003 calendário/feriados | Parcial | Cadastro por tribunal, UF e cidade; não considera vigência de suspensão nem calcula prazos automaticamente. |
| RF-AGE-004 alertas | Pendente | Não há agendamento ou escalonamento de notificações. |
| RF-AGE-005 agenda externa | Pendente | Sem integração de calendários externos. |
| RF-DAS-001 dashboard por perfil | Parcial | KPI pessoas/tarefas/audiências condicionado a permissão, dashboard anterior preservado; filtros e finanças avançadas faltam. |
| RF-DAS-002 fontes de indicadores | Parcial | Dados consultados em PostgreSQL, data de atualização e período presentes; fórmulas detalhadas não exibidas em todas as métricas. |
| RF-DAS-003 painéis interativos | Parcial | Links dos KPIs operacionais para suas telas; filtros globais e drill-down completo faltam. |
| RF-DAS-004 performance/cache | Impl. | Cache em arquivo por organização e perfil, TTL, escrita atômica, invalidação por mutações e proteção a concorrência. |
| RF-DAS-005 alertas de operação | Parcial | Destaques de tarefas vencidas; tratamento de falhas de fontes a aprimorar. |
| RF-UX-001/002 login e marca | Pré-existente | Identidade DS e temas da Justiça herdados da v0.8.1; não revalidados visualmente neste ciclo. |
| RF-UX-003 e RF-MOB-002 responsividade | Parcial | Layouts e menus adaptativos para pessoas/tarefas/agenda/Kanban; não houve teste de navegador em 360/768/1024/1440 px. |

## Verificação e limites

- O banco oficial permanece PostgreSQL; cache de indicadores e arquivos existentes não atuam como segundo banco transacional.
- O processo de atualização Windows cria backup lógico antes do schema Prisma e preserva os volumes; a restauração requer execução manual orientada.
- O PJe-Calc Cidadão não é executado automaticamente por esta versão; segue contrato de integração existente.
- Integrações financeiras, boletos, NFS-e, IA generativa, portal de clientes e o restante do catálogo Projuris seguem o backlog da Especificação Funcional v1.0.
- **Não usar o cadastro de feriados como cálculo de prazo processual.** Sem homologação por tribunal, os prazos exigem conferência humana.
