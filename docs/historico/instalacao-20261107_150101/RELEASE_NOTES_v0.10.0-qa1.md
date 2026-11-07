# SysADV 0.10.0-qa1 | 07/11/2026

**Escopo**: suíte de validação e gate de implantação, sem mudança de regra funcional nem renomeação de versão da API.

- Arquivo `docker-compose.qa.yml`: PostgreSQL descartável isolado do ambiente existente; API/Web acessíveis somente via localhost 19080/19081; fontes judiciais bloqueadas.
- `HOMOLOGAR_COMPLETO.ps1`: build de imagens, geração e validação Prisma, banco QA, smoke API, teste de concorrência de baixa, dump/restore, Playwright desktop/mobile e evidências por etapa.
- `IMPLANTAR_APOS_HOMOLOGACAO.ps1`: só executa atualização existente após testes aprovados, código sem alterações, evidências recentes e segredos de produção fortes.
- `scripts/qa/api-acceptance.mjs`: cenários reais de PostgreSQL, integridade, isolamento, permissões e fluxos de escritório com registros fictícios.
- `tests/e2e/office-acceptance.spec.ts`: autenticação e navegação de todas as 22 rotas, screenshots desktop/mobile e processo detalhado.
- Corrige teste E2E antigo que procurava título inexistente no login e torna baseURL configurável.
- `.dockerignore` impede cópia de `.env`, backups, arquivos de clientes e segredos privados para imagens Docker.
- Seed recusa senha administrativa implícita quando `NODE_ENV=production`; batch de atualização exige segredo configurado.
- Compose principal passa a aceitar senha/URL PostgreSQL rotacionadas via variáveis opcionais, preservando compatibilidade com bases antigas até a troca controlada. O gate exige credenciais fortes para dados reais.
- Fixa versão de `@playwright/test` na 1.52.0 para corresponder à imagem de execução de testes.

**Não executados na sessão de geração**: Docker build completo, Prisma validate/db push real, PostgreSQL, HTTP smoke, Playwright autenticado e deploy em Windows.
