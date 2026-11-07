# SysADV — leitura do catálogo público Projuris ADV e matriz preliminar de aderência

**Data do levantamento:** 06/11/2026. **Base:** `Projuris_ADV_Catalogo_Documentacao.xlsx` e `Indice_Navegavel_Projuris_ADV.md`, fornecidos pelo solicitante.

## Qualidade e abrangência da documentação

- **55 seções e módulos** (aba `Seções e módulos`, excluindo cabeçalho).
- **283 títulos** (aba `Artigos`, excluindo cabeçalho).
- **15 referências a páginas com imagens/GIFs** (aba `Telas e GIFs`, excluindo cabeçalho).
- **Os arquivos NÃO contêm os artigos integrais nem os binários das capturas de tela.** Muitos links são para a seção-pai; não se deve inferir o comportamento detalhado com base apenas no título.
- As descrições de funções abaixo referem-se ao catálogo de tópicos, e não à validação de cada fluxo em uma conta Projuris.

## Matriz preliminar Projuris (referência funcional) x SysADV

| Frente documentada | Situação na base SysADV 0.8.1 | Próxima implementação necessária |
| --- | --- | --- |
| Login, perfis, permissões e usuários | **Parcial** — autenticação, papéis, RBAC e auditoria existentes; identidade DS incorporada em 0.8.1 | Concluir UX de recuperação de senha com transporte de email e MFA antes de anunciar disponibilidade |
| Painel de controle / dashboards | **Parcial** — indicadores de processos, documentos, cálculos, integrações e cache | Métricas de prazos, tarefas, produtividade, desempenho e financeiro, com origem real validada |
| Atividades, agenda e Kanban | **Não desenvolvido** no frontend atual | Modelos de tarefa, compromissos, quadro Kanban, workflows e notificações |
| Contencioso / processos | **Parcial** — cadastro, atualização, detalhes, importação de dados e linha do tempo | Envolvidos, pedidos, garantias, apensos, carteira e ações em lote |
| Intimações, Push e andamentos | **Parcial** — publicações oficiais e movimentações existentes | Capturas programadas e por OAB, vinculação a processos, tratamento de falhas |
| Gestão de pessoas | **Não desenvolvido** como cadastro jurídico dedicado | Pessoas, contatos, relacionamentos, deduplicação e LGPD |
| Atendimentos | **Não desenvolvido** | Cadastro, assuntos, envolvidos, tarefas e vínculo com processos |
| Documentos e modelos | **Parcial** — biblioteca de modelos, versões, blocos, documentos, importação e geração | Editor rico preservando layout DOCX, colaboração, links externos, aprovação e assinatura |
| Cálculos e PJe-Calc | **Parcial** — workspace, pacotes e contrato de agente local | Integração real com execução local e validação jurídica mais completa |
| Financeiro e contratos de honorários | **Não desenvolvido** | Receitas/despesas, baixa, rateio, contratos, repasses, conciliação e relatórios |
| Relatórios | **Não desenvolvido** como módulo completo | Exportações configuráveis e relatórios por processos, pessoas, prazos e financeiro |
| Workflows e timesheet | **Não desenvolvido** | Fluxos de etapas, automações parametrizáveis e lançamentos de horas |
| Inteligência artificial | **Não desenvolvido** como assistente jurídico integrado | Casos de uso, revisão humana, fontes e privacidade por organização |
| Integrações APIs/Webhooks | **Parcial** — fontes oficiais configuráveis e saúde de conectores | Webhooks com assinaturas, retries, catálogo e versionamento de eventos |
| Aplicativo móvel | **Não desenvolvido** (há apenas responsividade web) | PWA, notificações móveis e suporte offline avaliado |

## Melhorias efetivamente implementadas nesta etapa (0.8.1)

1. Integração do logotipo da DS Advocacia Especializada à tela de login e navegação, com imagem otimizada WebP.
2. Tela de login redesenhada, ilustrada com Justiça e mantendo campos/autenticação originais.
3. Marca d'água da balança da Justiça aplicada ao workspace interno com `pointer-events:none`, sem obstruir interação.
4. Ajustes de contraste, cor, cartões, sidebar, tipografia e layout para telas pequenas.
5. Remoção da definição duplicada da rota `/templates`; prevalece a biblioteca jurídica v0.8.0.
6. Atualização de identificação de versão web/API e script Windows para v0.8.1.
7. Testes estáticos de regressão para os itens anteriores.

**Não afirmar que os 283 artigos foram implementados.** O catálogo orienta o backlog, não substitui especificações funcionais detalhadas, critérios de aceite, protótipos e testes de integração.

## Referências principais presentes nos anexos

- Portal: https://ajuda.projurisadv.com.br/space/BDC/30638083/Boas-Vindas+ao+Projuris+ADV
- Documentos: https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/29589518
- Atividades: https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/29491209
- Gestão: https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/29523969
- Financeiro: https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/29589509
- Documentações técnicas: https://projurishelp.atlassian.net/wiki/spaces/BDC/pages/27525705

Observação: muitos links apontam para seções, não para o artigo individual.
