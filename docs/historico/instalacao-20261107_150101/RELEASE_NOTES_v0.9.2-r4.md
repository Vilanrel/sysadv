# SysADV v0.9.2-r4 — Modernização visual responsiva

**Base:** pacote completo v0.9.2-r3 de Integrações Judiciais.
**Versão da API:** permanece 0.9.2; **revisão de interface:** r4.

## Modernização implementada

- Nova navegação agrupada em quatro áreas funcionais, com ícones SVG locais (sem dependências adicionais), indicação da rota ativa, menu recolhível no desktop e gaveta no mobile.
- Barra superior com pesquisa **de módulos autorizados** (não busca global de dados) e acesso à organização e saída.
- Estilos reutilizáveis para cabeçalhos, cartões, formulários, filtros, indicadores, tabelas, listas, alertas, botões e estados.
- Tabelas tradicionais ganham rótulos nas células e se reorganizam em cartões abaixo de 740 px, com ações preservadas.
- Melhorias de layout em dashboard, processos, pessoas, tarefas, Kanban, agenda, publicações, documentos, modelos, cálculos, fontes, integrações, auditoria e usuários.
- Listagem de processos: campo de busca local por NPU, partes e fase, contador de resultados, feedback de erro. **A busca filtra os registros já recebidos**, não substitui paginação ou busca no backend.
- Breakpoints 1250 / 980 / 740 / 430 / 340 px, focos visíveis, rolagem lateral restrita a componentes densos, respeito a redução de movimento.
- A tela de login mantém a identidade DS Advocacia e recebe ajustes de espaçamento e contraste.
- Metadado `sysadv-ui-release=r4` em `apps/web/index.html`.

## Referência no Canva

Foram importadas 19 páginas conceituais para um design Canva (protótipos esquemáticos, não capturas de telas autenticadas):
- Editar: https://www.canva.com/d/qvfJgm66d41kCzl
- Visualizar: https://www.canva.com/d/mKYUzgD_-6dHRgE

Arquivo HTML de origem em `docs/ui-modernizacao/SysADV_Canva_Referencia_19_Telas_UI_r4.html`.

## Instalação segura

1. Mantenha uma cópia do diretório SysADV e dos arquivos de configuração (`.env`).
2. Extraia este ZIP **por cima da instalação v0.9.2-r3**. Preserve a pasta `backups` e os volumes Docker.
3. Execute `TESTAR_UI_SEM_INSTALAR.bat` para validar a compilação **no seu Docker**.
4. Se o teste passar, execute `ATUALIZAR_INTERFACE.bat` para atualizar **apenas o container web**.
5. No navegador, recarregue com `Ctrl+F5` e teste os fluxos nas larguras 390, 768 e 1440 px.

**Atenção:** `ATUALIZAR_INTERFACE.bat` **não** executa `prisma db push`, `db:seed`, alterações em API ou volumes PostgreSQL. Se a instalação base não estava concluída, finalize a implantação da versão anterior antes de aplicar esta revisão visual.

## Limitações da validação

- Foi executada análise estática de sintaxe dos arquivos TS/TSX e parsing CSS.
- **Não houve build Vite/Docker completo** neste ambiente porque o registro npm não pôde ser alcançado para instalar dependências.
- **Não houve navegação autenticada** nem testes reais de telas contra a API/PostgreSQL; a revisão de responsividade das 19 páginas foi feita no código, com protótipos conceituais.
- A importação no Canva resultou em 19 páginas. A fidelidade e editabilidade de cada camada devem ser conferidas no editor Canva.
- Não foram alteradas regras jurídicas, controle de acesso, integrações DataJud/DJEN, prazos, banco ou backend.
