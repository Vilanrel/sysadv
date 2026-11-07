# SysADV — Refatoração, modernização de telas e performance

Pacote de evolução sobre a base `2026110701`. Não altera regras de negócio, permissões nem dados.

## Como publicar

1. Gere o número da versão: `.\GERAR_NOVA_VERSAO.bat` (o pacote **não** troca o identificador de release).
2. `.\TESTAR_BUILD_SEM_INSTALAR.bat` → `.\PUBLICAR_VERSAO.bat` (recria API, worker e Web).
3. **Opcional, recomendado:** `ATUALIZAR_SISTEMA.bat` aplica 2 índices novos no PostgreSQL (`prisma db push`).
   O sistema funciona sem eles; com eles, a lista de processos e a tela de detalhe consultam mais rápido.

O pacote não inclui `.env`, `backups/` nem a pasta `.git`: ao mesclar, os arquivos locais ficam preservados.

## Performance

| Item | Antes | Depois |
|---|---|---|
| JS inicial (código do app, gzip)* | ~133 KB, as 26 telas juntas | ~79 KB; cada tela baixa ao ser aberta (37 arquivos) |
| CSS (gzip) | 18,0 KB | 10,0 KB |
| Busca em Processos, Tarefas, Pessoas, Financeiro etc. | 1 requisição por tecla | 1 requisição após 250–300 ms de pausa |
| Listas de apoio (processos, pessoas, responsáveis) | baixadas de novo em cada tela | cache compartilhado de 5 min |
| `/processes` | todas as colunas, filtro só no navegador | só as colunas da tabela, busca no banco (`?q=`) |
| Selects de processo | lista completa (máx. 100) | `/processes/options` (id + NPU, até 2.000) |
| Token expirado com várias chamadas paralelas | 1 `/auth/refresh` por chamada | 1 único refresh compartilhado |
| Gravação de evidências ao salvar processo | 1 INSERT por campo, em sequência | 1 `createMany` |
| Detalhe do processo | processo e linha do tempo em sequência | em paralelo |
| Kanban ao mover cartão | espera o servidor e recarrega tudo | move na hora (otimista) e desfaz se falhar |
| nginx | sem compressão, sem cache de assets | gzip + cache de 1 ano para `/assets` (nomes com hash) |

\* Medido com esbuild, sem as bibliotecas react-router, react-query e react-hook-form (que não estavam no ambiente de build), mesma base nos dois lados.

**Correção encontrada:** o nginx usava o limite padrão de corpo (1 MB), então uploads de documentos acima de 1 MB eram recusados antes de chegar à API (que aceita 20 MB). Agora `client_max_body_size 50m`.

## Telas

- Novo design system com tokens (cores, raios, sombras, tipografia), substituindo o CSS acumulado das rodadas r4–r6: de 425 cores fixas para 62, de 54 `!important` para 11, sem as 393 regras `.app-modern`.
- **Tema escuro** automático (segue o sistema) com alternância manual na barra superior; a escolha fica salva no navegador.
- Identidade DS Advocacia preservada (navy + dourado, marca d'água da Justiça); títulos em serifa (Source Serif 4) e textos em Inter.
- `alert`, `confirm` e `prompt` do navegador trocados por diálogo e notificações (toasts) do próprio sistema, em: Processos, Detalhe do processo, Pessoas, Kanban, Agenda, Prazos, Financeiro, Modelos, Publicações e Usuários.
- Esqueletos de carregamento nas listas e nas trocas de tela, em vez de "Carregando...".
- Kanban: destaque da coluna de destino ao arrastar.
- Dashboard: acentuação corrigida ("Visão", "Período", "Cálculos" etc.).

## Código

- `features/auth/api.ts`: `apiJson<T>()` e `ApiError` com o código do backend; refresh único.
- `AuthProvider`: `has()` estável (antes era recriada a cada render e forçava recargas), uma só chamada a `/auth/me` no login, cache limpo no logout.
- `app/hooks.ts`: `useDebouncedValue`, `useProcessOptions`, `usePeopleOptions`, `useAssignees`.
- `components/feedback.tsx` (`useFeedback`: `toast`, `confirm`, `prompt`) e `components/ui.tsx` (skeletons, estado vazio).
- Rotas carregadas sob demanda (`React.lazy`) com `Suspense` no `AppShell`.
- `OfficeShared.useOfficeList` passou para React Query (cache, sem tabela piscando na paginação), mantendo a mesma interface.

## Validação feita

- 80 dos 86 testes estáticos (`scripts/tests`) passam, o mesmo resultado da base: as 6 falhas já existiam (verificam a versão 0.9.0 e o `ATUALIZAR_INTERFACE.bat`).
- `check-esm-imports` e `qa/offline-structural` sem pendências.
- Todo o frontend e a API compilam com esbuild.
- QA visual (Playwright) em 1440 px e 390 px, nos temas claro e escuro, sem rolagem horizontal.
- **Não executado aqui:** `tsc -b` completo, `vitest` e o fluxo E2E. O ambiente não tinha `node_modules` nem acesso ao npm. Rode `TESTAR_BUILD_SEM_INSTALAR.bat` antes de publicar.
