# SysADV v0.9.2-r5 — Inventário e modernização das telas

**Base examinada:** `apps/web/src/app/router.tsx`, componentes React/TypeScript e `styles.css` do SysADV v0.9.2-r4. A versão da API permanece 0.9.2.

| Nº | Rota | Tela real no código | Estratégia responsiva |
|---:|---|---|---|
| 01 | `/login` | Acesso | Formulário de uma coluna, identidade e ilustração originais da aplicação |
| 02 | `/` | Dashboard | Indicadores e painéis em grade adaptável; novo estado de carregamento |
| 03 | `/processes` | Processos | Busca, filtros e tabela adaptada para cartões no celular |
| 04 | `/processes/new` | Cadastro de processo | Campos e ações empilhados no celular |
| 05 | `/processes/:id` | Detalhes de processo | Grade de metadados e timeline adaptáveis |
| 06 | `/processes/:id/edit` | Edição de processo | Campos redimensionáveis e ações sem corte |
| 07 | `/publications` | Publicações | Lista, revisão de conteúdo e tabela adaptáveis |
| 08 | `/people` | Pessoas/clientes | Mestre-detalhe vertical no tablet/celular |
| 09 | `/tasks` | Tarefas | Filtros em coluna e tabela em cartões |
| 10 | `/kanban` | Quadros Kanban | Colunas com rolagem horizontal com foco por teclado |
| 11 | `/agenda` | Agenda | Calendário rolável na sua região, formulário em uma coluna |
| 12 | `/documents` | Documentos | Lista e ações adaptáveis |
| 13 | `/templates` | Modelos jurídicos | Lista e editor empilhados, preview controlado |
| 14 | `/calculations` | Cálculos | Cards e lista adaptáveis |
| 15 | `/calculations/:id` | Workspace de cálculo | Tabs horizontais em tablet, editor em largura total |
| 16 | `/sources` | Fontes de dados | Cards, formulário e tabelas adaptáveis |
| 17 | `/integrations` | Integrações judiciais | Catálogo, jobs, formulários e triagem em largura flexível |
| 18 | `/audit` | Auditoria | Tabela adaptável, origem e horário legíveis |
| 19 | `/users` | Usuários | Controles de acesso e tabela adaptável |

A rota `/admin` é um redirecionamento para `/users`, não uma 20ª tela funcional.

## Alterações transversais r5

- Preservada navegação por permissões e identidade por organização; buscador do topo continua buscando **módulos autorizados**, não processos globais.
- Adicionados link *Pular para conteúdo*, nomes acessíveis para menu colapsado, foco e contenção de tabulação na gaveta, tecla `/` para busca e persistência local da preferência de menu compacto.
- Colunas de tabelas rotuladas automaticamente, com atualizações agrupadas por `requestAnimationFrame` para evitar repetições excessivas.
- Mantidos scroll interno em Kanban, calendário e abas de cálculo, sem deslocar horizontalmente toda a página.
- Melhorado toque em botões, tamanho mínimo de inputs em dispositivos touch, contraste de ações e respeito a `prefers-reduced-motion`.
- Ajustado estado de carregamento do dashboard para evitar exibir dados do intervalo anterior durante a atualização.
- A identidade da DS Advocacia existente no projeto foi preservada, sem substituição por logotipos gerados.

## Evidência e limite

- Código inspecionado: 19 rotas reais e layout global.
- Sintaxe: analisados 125 arquivos TS/TSX das camadas API, web e contracts; nenhuma falha de parsing encontrada.
- CSS: analisado com PostCSS; stylesheet válido.
- Layout representativo **não autenticado**: Chromium + fixture HTML com CSS real nas larguras 390, 768, 1024 e 1440 px. Todas sem overflow horizontal da página; cartões ativos em 390px; calendário rola apenas localmente.
- Não executados: `npm run build`, TypeScript typecheck com dependências, Selenium/Playwright autenticado por rota, testes reais da API/PostgreSQL, screenshot de cada componente após login. Isso depende das dependências/npm e do ambiente instalado.

## Uso das imagens geradas

O Image Generator gerou duas **propostas de estilo** em `image-generator/`. Elas incluem texto e métricas fictícias e, portanto, **não são ativos para produção**. A versão r5 implementa layout real com CSS/React; não aplica a composição ilustrativa como se fosse uma tela interativa.
