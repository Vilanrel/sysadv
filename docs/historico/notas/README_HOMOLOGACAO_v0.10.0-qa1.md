# SysADV v0.10.0-qa1 — Pacote de compilação e homologação

Este é **um candidato para validação, não uma versão declarada homologada**. Trata-se do v0.10.0 acrescido de ambiente de homologação isolado, testes de API/PostgreSQL, testes Playwright para 22 rotas, validação de restauração e gate de implantação. Não altera o versionamento funcional da API (0.10.0).

## Pré-condições no Windows

1. Docker Desktop **Engine running** (containers Linux); `docker version` deve mostrar Client **e Server**. Verifique a virtualização/WSL2 se necessário.
2. Sem necessidade de Node/npm no host para a homologação: instalação de dependências ocorre no build Docker, com acesso ao Docker Hub/Microsoft Container Registry/npm.
3. Portas de homologação locais **19080** (web) e **19081** (API) livres. Não são abertas na rede; bind apenas em `127.0.0.1`.
4. Espaço disponível para baixar/buildar `postgres:16-alpine`, `node:22-alpine`, `nginx:1.27-alpine` e imagem Playwright. Docker tem de ter rede.
5. NÃO copie `.env` real para `docker-compose.qa.yml`: o QA gera seus próprios segredos e DB, desabilita integrações judiciais e não lê `.env` principal.

## 1. Homologar em isolamento

Na pasta `C:\Temp\Sistemas\SysADV`, faça uma cópia de segurança e extraia os arquivos deste pacote **sem remover** `.env`, `backups` e volumes.

```powershell
cd C:\Temp\Sistemas\SysADV
powershell -NoProfile -ExecutionPolicy Bypass -File .\HOMOLOGAR_COMPLETO.ps1
```

Etapas automatizadas com parada imediata ao falhar:

1. Compose QA validado e impressão digital do código registrada.
2. Build Docker de **API, Web e runner de navegador**; worker judicial conferido no artefato da API.
3. PostgreSQL 16 exclusivamente no projeto Compose `sysadvqa...` e em volume novo, sem porta externa.
4. `prisma validate`, `prisma db push` **apenas no banco QA** e `db:seed` com senha QA aleatória.
5. API + PostgreSQL: autenticação, RBAC, clientes, processos, atendimentos, honorários, financeiro, baixas parcial/total/idempotência, concorrência, timesheet, relatórios, auditoria, isolamento de tenant e proteção do DataJud.
6. Dump PostgreSQL QA (`pg_dump -Fc`) e teste de restauração em outro banco QA (`pg_restore`).
7. Teste Playwright real: 22 rotas autenticadas em desktop, smartphone 390px, navegação, responsividade, screenshots e testes de detalhe/edição de processo.
8. Remoção de containers e volume **QA somente** ao final (mesmo após falha), salvo com `-PreservarAmbienteQA` para investigar.

Evidências são salvas em `qa_evidencias\<data>\` e o último resultado é `qa_evidencias\ULTIMO_RESULTADO.json`. Não edite esses arquivos para simular aprovação. Quando uma etapa falha, o resultado fica `failed` e o comando retorna erro. O processo **não toca os volumes do PostgreSQL instalado**.

## 2. Implantação no ambiente instalado

Não atualize o sistema principal caso a homologação tenha falhado. A verificação prévia de produção exige evidências **aprovadas nas últimas 24h**, todos os estágios aprovados, código idêntico e segredos fortes no `.env` (incluindo `SEED_ADMIN_PASSWORD`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\IMPLANTAR_APOS_HOMOLOGACAO.ps1
```

Se as verificações passarem, e **somente após** realizar backup também de documentos/arquivos, HTTPS, credenciais DB rotacionadas e ter plano de retorno, execute explicitamente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\IMPLANTAR_APOS_HOMOLOGACAO.ps1 -ConfirmarProducao
```

O comando chama `ATUALIZAR_SISTEMA.bat`, que faz `pg_dump` antes de sincronizar o schema. **A versão ainda utiliza `prisma db push` (sem migrações versionadas)**: realize um ensaio contra cópia da base antes de qualquer ambiente com dados reais. Não confunda o backup `.dump` com um teste de restauração do banco principal. Documentos também precisam de backup independente e conferido. O gate também exige `SYSADV_DB_PASSWORD` e `SYSADV_DATABASE_URL` com credenciais fortes, previamente **rotacionadas na role PostgreSQL**. Não basta alterar o `.env` após o volume PostgreSQL ter sido inicializado: a role existente precisa ser alterada de modo transacional e previamente testado. O compose mantém valores legados apenas para não quebrar instalações antigas; esses valores não são aceitos pelo gate de produção. A verificação de credenciais não substitui revisão de segurança, HTTPS nem validação jurídica.

## Critérios de aceite

- Nenhum log de TypeScript/Prisma, 4xx indevido ou 5xx nas consultas essenciais; imagens geradas pelo Playwright devem representar a aplicação autenticada.
- Nenhum pagamento excede o lançamento; idempotência não duplica o mesmo movimento; transações simultâneas conflitantes são negadas.
- Documentos, pessoas, processos, contratos e dados financeiros são isolados por escritório, com permissões de leitura/gestão.
- Dados do DataJud comercial e ações processuais com efeito de ciência/petição permanecem bloqueados, salvo autorização e homologação específica.
- Advogado responsável valida prazos, publicações, conteúdos, comunicação, fluxo do escritório e usabilidade; responsável técnico valida segurança, backup, restauração e performance.

## Limitações conhecidas

O pacote contém suites para executar no computador com Docker, mas **a compilação e a implantação reais não puderam ser realizadas na sessão de geração** porque não existe Docker Engine/PostgreSQL local e o registro npm não resolve por DNS. O teste Playwright de fixture estático também foi bloqueado pela política de navegação local. Não divulgar a release como homologada antes de obter `ULTIMO_RESULTADO.json` com `passed` de uma execução real.

Os 283 títulos do levantamento de produto não são 283 especificações integralmente implementadas; este pacote não acrescenta novos módulos funcionais além dos já presentes no v0.10.0. Não executar contra dados reais até fechar as pendências de escopo, migrations, segurança e aceite jurídico.
