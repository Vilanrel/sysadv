# SysADV v0.9.2-r5 — Responsividade, navegação e QA visual

Base: v0.9.2-r4, sem alteração de contratos, API, banco PostgreSQL ou integrações judiciais.

## Mudanças reais de frontend

1. AppShell: navegação em gaveta com contenção de foco e restauração do foco; menu lateral compacto persistido localmente; busca de módulos com atalho `/` e saída por `Esc`; links acessíveis em menu recolhido; link para pular ao conteúdo.
2. Tabelas: layout de cartões e rótulos para as células em mobile; atualização do tratamento de rótulos agrupada por `requestAnimationFrame`.
3. Agenda e Kanban: regiões de rolagem horizontais com foco para navegação por teclado; calendário evita rolagem da página inteira.
4. Dashboard: placeholders durante atualização de métricas; não mostra métricas antigas como se fossem do período novo.
5. CSS: melhorias de adaptabilidade, legibilidade e controles touch em 390px/768px/1024px/1440px, tratamento de estados de foco, e redução de animações quando solicitada.
6. HTML: `sysadv-ui-release=r5`. Identidade DS preservada.

## Material visual

- Estudos conceituais Image Generator (2 PNGs) em `docs/ui-modernizacao/image-generator/`. **Não** são interfaces reais ou compiláveis; números e algumas seções são fictícios.
- Layout estático de QA em `tests/ui-r5/layout-fixture.html`, com screenshots representativos e sem dados reais em `docs/ui-modernizacao/qa/`.

## Instalação

1. Preserve um backup completo da instalação, incluindo `.env` e dados persistentes.
2. Extraia o ZIP completo sobre o diretório da versão existente, sem excluir arquivos de configuração, backups ou volumes Docker.
3. Execute `TESTAR_UI_SEM_INSTALAR.bat`. Se o build passar, execute `ATUALIZAR_INTERFACE.bat`.
4. O atualizador reconstrói e recria somente `sysadv-web`; não aplica migrações de banco.
5. Recarregue a página com `Ctrl+F5`. Teste desktop, tablet e celular com usuário autorizado.

## Validação

- Parse de 125 arquivos TypeScript: sucesso; CSS PostCSS: sucesso.
- Chromium com fixture estático em 390/768/1024/1440px: sem overflow horizontal global; tabela usa cards no celular; calendário rola internamente.
- **Pendente:** build Docker/Vite real, typecheck completo e testes autenticados em todas as telas. Os módulos e conectores não foram homologados por esta entrega visual.
