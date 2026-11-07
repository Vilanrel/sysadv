# SysADV v0.8.0 — levantamento funcional a partir da documentação pública do Projuris ADV

Data: 06/11/2026. Este levantamento foi feito **sem ativar avaliação, sem login, sem coleta de dados privados**. As informações abaixo são funcionais e não implicam acesso ao código ou reprodução da aparência proprietária.

## Fontes oficiais consultadas
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1115086 — índice de modelos.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1114868 — conceitos, biblioteca, blocos e variáveis.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1114562 — blocos genéricos.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1114582 — blocos exclusivos.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1114537 — variáveis.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1114574 — gerar por processo.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1114513 — gerar por atendimento.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1114551 — gerar por tarefa.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1114594 — editor.
- https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/1118021 — IA para modelos.

## Matriz de funcionalidades e situação nesta release

| Fluxo na referência | SysADV v0.8.0 | Observação |
| --- | --- | --- |
| Listagem e biblioteca de modelos | Implementado | Busca, categoria, descrição e edição |
| Criar modelos do zero | Implementado | Editor textual com cabeçalho e rodapé |
| Variáveis da entidade Processo | Implementado parcialmente | NPU, partes, tribunal, órgão, advogado, fase |
| Variáveis de Pessoa e Atendimento | Não implementado | Ausência de entidades equivalentes completas no núcleo atual |
| Data atual e usuário | Implementado | Preenchimento contextual |
| Blocos genéricos e exclusivos | Implementado | Referência `{{bloco:ID}}` no modelo e seleção ao gerar |
| Pré-visualizar antes de salvar | Implementado | Detecta variáveis não resolvidas |
| Gerar a partir de Processo | Implementado | Na aba Documentos do processo |
| Gerar a partir de Tarefa ou Atendimento | Não implementado | Requer módulos de contexto |
| Importar DOCX | Parcial | Importa apenas texto; formatação rica não é preservada |
| Exportar DOCX/PDF | Parcial | Exportações textuais, sem editor visual rico |
| Office 365 | Não implementado | Exige autorização e integração de terceiros |
| Modelos sugeridos e geração por IA | Não implementado | Requer especificação, governança e revisão humana |
| Publicação para área do cliente | Parcial | Metadados de privacidade; não cria um portal do cliente |

## Arquitetura de persistência híbrida
- PostgreSQL continua sendo fonte de verdade para organizações, processos, modelos, blocos, histórico, permissões, metadados e auditoria.
- Volume `sysadv_documents` armazena conteúdos binários com referência no PostgreSQL.
- Volume `sysadv_pjecalc` armazena artefatos do PJe-Calc.
- Volume `sysadv_dashboard_cache` mantém JSON descartável e derivado do PostgreSQL por organização e período (30s); o cache nunca substitui a gravação transacional.
- Antes de implantar: backup, validação de schema, testes de permissão multiempresa e checagem do Docker local.

## Evolução planejada
1. Editor rico com tabelas, imagens, cabeçalhos/rodapés e fidelidade DOCX.
2. Campos dinâmicos de Pessoa, Atendimento e Tarefa.
3. Revisões, aprovação e publicação de modelos e documentos.
4. Integração Office 365 e IA sob avaliação de privacidade, custos e revisão profissional.
5. Testes end-to-end, carga e recuperação de backups.
