# SysADV 0.10.0-qa1 — Relatório de execução e limitações

**Emissão:** 07/11/2026. **Base:** código SysADV 0.10.0 entregue nesta conversa. **Objetivo:** preparar compilação, homologação automatizada e implantação com gate; não declarar produção liberada sem evidência.

## Executado nesta sessão

| Ação | Situação | Evidência |
|---|---|---|
| Leitura e inventário do monorepo | Concluído | Node/Fastify, React/TypeScript, PostgreSQL/Prisma, integrações judiciais, 22 rotas principais |
| Parser TypeScript de 183 arquivos `.ts/.tsx/.js/.mjs` | Aprovado, 0 erros sintáticos | `scripts/qa/offline-structural.cjs`, saída validada |
| 3 testes unitários de regras financeiras/datas | Aprovados | `node --experimental-strip-types --test tests/office/office-math.test.ts` |
| Parse dos 2 arquivos Docker Compose com verificação de chaves | Aprovado | 4 serviços no compose operacional e 4 no compose QA |
| Compilação do pacote contracts | Não concluída | Erro `TS2307: Cannot find module 'zod'`, porque dependências não estão instaladas |
| Instalação de dependências npm | Bloqueada | DNS do `registry.npmjs.org` indisponível neste ambiente |
| Docker build API/Web/worker | Não executado | Docker Engine/CLI ausente neste ambiente |
| Prisma validate e schema em PostgreSQL real | Não executados | PostgreSQL não disponível neste ambiente |
| API integrada em PostgreSQL, restore de backup e concorrência | Não executados | Suíte escrita, depende de Docker/PostgreSQL reais |
| Navegação autenticada nas 22 rotas e screenshots | Não executada | Suíte Playwright escrita; teste de fixture local foi bloqueado por política de navegação |
| Instalação no Windows do usuário | Não executada | Sem acesso ao Docker Desktop/arquivos do computador do usuário |

**Não interpretar ausência de erros de sintaxe como build completo ou homologação aprovada.**

## Testes entregues para execução real no Windows

`HOMOLOGAR_COMPLETO.bat` / `.ps1` cria projeto Docker `sysadvqa...` isolado e gera evidências em `qa_evidencias/`. Valida e compila API, Web, runner de navegador e artefato do worker; cria banco QA no PostgreSQL 16; aplica schema Prisma; executa seed com segredo aleatório; testa API, regras, permissões e acesso entre escritórios; valida dump/restore; roda Playwright em desktop e mobile nas 22 rotas principais; encerra/removerá somente os recursos QA por padrão.

Os scripts foram revisados estaticamente, mas **não foram executados de ponta a ponta nesta sessão**. Se falharem em seu Docker, a homologação permanece reprovada até correção comprovada.

## Ajustes técnicos no pacote

- `.dockerignore` para impedir credenciais `.env`, backups e segredos dentro das imagens Docker.
- Controle de senha inicial do administrador: em produção, exige `SEED_ADMIN_PASSWORD`; não permite fallback automático a senha de exemplo.
- Compose principal aceita `SYSADV_DB_PASSWORD` e `SYSADV_DATABASE_URL` após rotação controlada da senha PostgreSQL, preservando defaults legados até que a operação execute a mudança.
- `IMPLANTAR_APOS_HOMOLOGACAO.ps1` verifica evidências recentes, identidade do código, segredos e parâmetros de produção antes de acionar o instalador original.
- Corrigida a asserção da tela de login no teste E2E antigo; testes Playwright usam versão alinhada ao navegador de testes.
- Suíte de API/PostgreSQL de exemplos fictícios: isolamento de tenant, baixa parcial e total, idempotência, corrida financeira, contratos, timesheet e relatórios.

## Pendências que impedem classificar como pronto para dados reais

1. Build Docker/Vite/TypeScript completo com dependências e registro de versão/artefatos.
2. Execução do PostgreSQL QA, Prisma e smoke API sem falhas.
3. Playwright autenticado e inspeção humana de layouts, acessibilidade, formulários, fluxos e dados.
4. **Migrações Prisma versionadas** (o instalador legado usa `prisma db push`, sem histórico de migrations); uma alteração na base real requer ensaio em cópia e plano de rollback.
5. Teste de backup/restauração **dos dados e arquivos existentes**, não só do banco QA descartável.
6. Rotação do usuário e senha do PostgreSQL, gestão de segredos, HTTPS, perfis, auditoria e aprovação de segurança.
7. Aceite funcional de advogado responsável (prazos, publicações, contratos, rotinas do escritório). Integrações de ciência/peticionamento dependem de credenciamento, autorização e homologação específicos.

## Próximos comandos no Windows

Abra o Docker Desktop até indicar Engine running. Em `C:\Temp\Sistemas\SysADV`, após extrair o pacote e preservar `.env`/backups, execute **primeiro**:

```powershell
.\HOMOLOGAR_COMPLETO.bat
```

Examine `qa_evidencias\ULTIMO_RESULTADO.json` e os logs por etapa. Só após resultado `passed`, revisão de banco/código/segredos e o aceite operacional, execute a checagem sem implantação:

```powershell
.\IMPLANTAR_APOS_HOMOLOGACAO.bat
```

Para implantar, é exigido o argumento **explícito** `-ConfirmarProducao`, com todas as condições satisfeitas. Um status `failed` bloqueia a liberação. A produção não foi alterada por este trabalho.
