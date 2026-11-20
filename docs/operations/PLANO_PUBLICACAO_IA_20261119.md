# SysADV — Procedimento de liberacao segura 20261119 (candidato)

**Esta e uma preparacao de publicacao, nao uma autorizacao para migrar o banco sem backup.**

## Diagnostico confirmado no Railway production

- Servicos: `@sysadv/web`, `@sysadv/api` e `Postgres` ativos.
- `Postgres`: imagem PostgreSQL 18 com volume persistente `postgres-volume`.
- API: rollback para uma versao anterior depois de `Prisma P2022` pela coluna `User.emailNotificationsOptIn` ausente.
- A interface da IA depende da tabela `LegalAiSettings` e da API atualizada. Um merge isolado sem migracao reproduziria o problema.
- Nao existe uma copia fork do ambiente registrada no Railway.
- A verificacao de volume backup/restauracao ainda nao tem evidencia disponivel.
- Nao ha alteracoes de Railway pendentes/staged.

## Pronto no GitHub

- PR #7 — tela de configuracao IA, armazenamento criptografado por escritorio, auditoria sem segredo e teste de conexao.
- QA automatizada executa PostgreSQL descartavel, testes, builds, migracoes, schema diff e smoke multitenant.
- `scripts/qa/production-schema-preflight.mjs` consulta SOMENTE metadados; nunca modifica banco de producao.
- Smoke cobre chave OpenAI criptografada e isolamento entre organizacoes.

## Portoes obrigatorios antes do deploy

1. **Backup:** confirmar em Railway/volume Backups que existe snapshot restauravel recente do banco e registrar ID/timestamp. Para seguranca adicional, obter `pg_dump -Fc` com checksum SHA-256. Nao registrar credenciais em logs.
2. **Restauracao:** criar copia isolada PostgreSQL 18, executar restauracao e verificar integridade/contagens.
3. **Schema real:** conferir tabelas, colunas e metadados de `_prisma_migrations` diretamente sobre o banco existente em modo somente leitura. O script `production-schema-preflight.mjs` e util quando executado em ambiente autorizado com acesso a `DATABASE_URL`. Como as migracoes ainda nao foram aplicadas, um exit code 2 e esperado; usar sua lista de ausencias para planejar.
4. **Prisma baseline:** comparar o schema real com `prisma/baseline/schema.prisma`. Resolver divergencias existentes antes de marcar a baseline como aplicada. Jamais marcar uma migracao sem confirmar equivalencia do DDL correspondente.
5. **Ensaiar QA real:** aplicar migracoes incrementais na copia restaurada usando `prisma migrate deploy`. Validar `prisma migrate status`, `prisma migrate diff` (zero drift), login real em ambiente isolado, tenants, API/Web, permissao para `settings.manage` e criptografia.
6. **Janela de publicacao:** emitir backup final, aplicar exatamente o plano ensaiado, publicar API e Web do mesmo commit, rodar smoke de login e consultas /api/auth/me e /api/office/legal-ai. Nao ativar IA antes de confirmar ambiente.
7. **Rollback:** em caso de erro, suspender trafego ou restaurar API anterior e recuperar snapshot quando ocorrer DDL incompativel. Reverter apenas a API **nao** reverte alteracoes no banco. Ter restore ensaiado antes da janela.
8. **Versao:** atribuir mascara AAAAMMDDNN apenas quando a release estiver operacional e homologada.

## Condicoes que impedem declaracao de publicacao

- Aprovacao de Actions no banco descartavel nao comprova que o schema real seja compativel.
- Railway OAuth deste assistente fornece inventario, configuracao e deploy, mas nao expõe backup/restore, fork-create ou terminal PostgreSQL de producao nas ferramentas conectadas.
- Sem evidencias de backup e de ensaio de restauracao, **nao realizar merge que cause auto-deploy de API incompatível**.
- Chave `LEGAL_AI_API_KEY` pode ser cadastrada na UI so depois de aplicar a migracao e disponibilizar o endpoint; usuario deve inserir a chave no proprio sistema, nunca no GitHub.
