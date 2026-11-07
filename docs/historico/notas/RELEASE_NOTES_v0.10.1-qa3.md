# SysADV v0.10.1-qa3 — correção de compilação da Agenda

- Corrige TS1117 por duplicação da propriedade `DEADLINE` em `AgendaPage.tsx`.
- Preserva a diferença entre compromisso de prazo e prazo fatal aprovado no calendário.
- Adiciona 2 testes de regressão para o incidente.
- Corrige posicionamento de `--progress plain` na chamada de build do Compose QA, eliminando um aviso não fatal.
- Sem mudanças de esquema Prisma ou migrações PostgreSQL.
- Status: candidato a homologação; build Docker/Vite/Prisma/Playwright e uso com dados reais ainda dependem de validação.
