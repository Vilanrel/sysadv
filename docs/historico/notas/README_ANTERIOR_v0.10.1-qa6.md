> **Atualização v0.10.0:** consulte [RELEASE_NOTES_v0.10.0.md](RELEASE_NOTES_v0.10.0.md). Esta versão adiciona módulos operacionais com persistência em PostgreSQL; não use apenas ATUALIZAR_INTERFACE.bat.

# SysADV v0.9.2-r5 — Interface responsiva

Veja `RELEASE_NOTES_v0.9.2-r5.md` e `docs/ui-modernizacao/INVENTARIO_TELAS_UI_r5.md`.

## Interface responsiva SysADV v0.9.2-r4

Modernização global da UI, com referências em 19 páginas Canva e instalador web-only. Veja `RELEASE_NOTES_v0.9.2-r4.md`. Para testar sem instalar, execute `TESTAR_UI_SEM_INSTALAR.bat`; para atualizar apenas web, `ATUALIZAR_INTERFACE.bat`.

## Atualizacao v0.9.2-r2 — Correcao do Docker Compose

A revisao r2 inclui `REPARAR_COMPOSE.bat` (backup + restauracao do arquivo YAML),
`VERIFICAR_COMPOSE.bat` e `ATUALIZAR_SISTEMA.bat` validando explicitamente o
arquivo principal. Para esta instalacao, consulte `CORRECAO_COMPOSE_v0.9.2-r2.md`.
A API continua identificada como versao `0.9.2`.

## Atualização incremental SysADV v0.9.0 (Pessoas, Tarefas, Kanban e Agenda)

A v0.9.0 incorpora a primeira etapa da Especificação Funcional v1.0. Os novos módulos permitem cadastro e vínculo de pessoas a processos, tarefas com responsáveis e checklists, quadros Kanban, agenda de compromissos e audiências, referência de feriados e indicadores operacionais no dashboard. A API aplica permissões e isolamento por organização; alterações auditadas são persistidas no PostgreSQL.

**Atenção jurídica:** o registro de feriados e tarefas não configura cálculo automático de prazos judiciais. Confira contagem, suspensões e calendário na fonte oficial do tribunal.

**Atualização segura (Windows):** mantenha `.env` existente, confira a porta `SYSADV_WEB_PORT` (padrão 9080), extraia o ZIP na pasta do SysADV e execute `ATUALIZAR_SISTEMA.bat`. O instalador faz o build antes de atualizar o banco, grava um backup PostgreSQL em `backups/`, aplica alterações aditivas do Prisma e faz o seed de permissões. Não execute `docker compose down -v`.

Leia `RELEASE_NOTES_v0.9.0.md` para os requisitos abrangidos e as limitações da homologação.

# SysADV v0.6.0

Sistema de Auxílio aos Advogados com Judicial Data Gateway, processos, documentos, cálculos, publicações oficiais, movimentações, fontes de dados configuráveis, auditoria e gestão segura de usuários.

## Principais capacidades

- autenticação com Argon2id, access token e refresh token rotativo/revogável;
- RBAC por organização;
- processos com NPU, roteamento por segmento judicial e integração DataJud;
- histórico persistido de movimentações DataJud;
- publicações oficiais vinculadas ao NPU e linha do tempo unificada;
- proveniência e evidências por campo;
- Fontes de Dados com URL, ambiente, autenticação, headers, timeout, retry/backoff, limites, sincronização, parâmetros avançados e teste de conexão;
- segredos das fontes criptografados em repouso com AES-256-GCM;
- usuários com perfis, MFA requerido, último acesso, status, sessões, redefinição de senha, bloqueio/inativação e eventos de segurança;
- proteção do último administrador ativo;
- auditoria e telemetria de integrações;
- Docker Compose com PostgreSQL persistente.

## Atualização no Windows

Preserve seu `.env` e execute:

```powershell
.\ATUALIZAR_SISTEMA.bat
```

O script força rebuild sem cache, executa `prisma db push`, reaplica o seed e só conclui quando `GET /api/system/version` retornar `0.6.0`.

Validação manual:

```powershell
.\VERIFICAR_VERSAO.bat
```

## URLs

- Web: http://localhost:8080
- Health: http://localhost:3001/api/health
- Versão: http://localhost:3001/api/system/version
- OpenAPI: http://localhost:3001/documentation

## Fontes de Dados

O DataJud continua operacional. Sua APIKey pode permanecer em `DATAJUD_API_KEY` ou ser armazenada no menu **Fontes de Dados** como segredo `API_KEY`; a configuração administrada tem precedência.

DJEN/PJe/Jurisprudência podem ser cadastrados e testados. O SysADV não simula integrações não autorizadas. Para uma fonte de publicações genérica, a configuração avançada aceita, entre outros, `publicationSearchPath`, `searchMethod`, `itemsPath` e `fieldMapping`.

## Segurança

- nunca versionar `.env`;
- configure segredos longos e exclusivos;
- `SOURCE_ENCRYPTION_KEY` pode ser definido para criptografia dedicada dos segredos das fontes; se ausente, há fallback compatível para `REFRESH_TOKEN_SECRET`;
- segredos não são retornados pelas APIs de leitura nem registrados em auditoria;
- use TLS em produção;
- não exponha PostgreSQL fora da rede interna;
- mantenha backups criptografados e política de retenção compatível com LGPD e sigilo processual.

## Persistência

`docker compose down` mantém os volumes. Não use `docker compose down -v` se quiser preservar banco e documentos.

## Documentação

- Especificação técnica v0.6.0: `docs/tecnica/SysADV_Especificacao_Tecnica_v0.6.0.docx`
- Notas da release: `RELEASE_NOTES_v0.6.0.md`

## v0.7.0 — PJe-Calc
A versão 0.7.0 adiciona workspace de cálculos, validação/versionamento, artefatos `.PJC`, pacote de preparação, contrato de agente local e rastreabilidade por SHA-256. O arquivo de preparação do SysADV não substitui o formato proprietário/operacional exportado pelo PJe-Calc; a integração automática deve ocorrer pelo agente instalado no ambiente autorizado.


## SysADV v0.8.0 - modelos, cache e dashboards

- Menu **Modelos Juridicos**: cadastro e versionamento, blocos genericos/exclusivos, variaveis vinculadas a processos, pre-visualizacao, importacao DOCX e exportacao PDF/DOCX vinculada ao processo.
- Fonte oficial: documentacao publica Projuris ADV (fluxos funcionais reimplementados com identidade SysADV). Nenhuma conta do Projuris foi utilizada.
- Persistencia hibrida: PostgreSQL e fonte transacional; arquivos em volumes Docker guardam documentos/PJe-Calc e cache descartavel de dashboards. O cache tem TTL de 30 segundos e grava atomica; nao armazena uma segunda copia transacional editavel.
- Dashboards: recortes 7/30/90/365 dias, graficos por fase/tribunal/calculos/fontes, atualizacoes recentes.
- Web: porta do host configuravel via `SYSADV_WEB_PORT` (padrao 9080). Se o Windows bloquear a porta, escolha uma livre e nao reservada.
- Atualizacao: faca backup do PostgreSQL e da pasta `.env`, extraia a release sobre o codigo e execute `ATUALIZAR_SISTEMA.bat`. Nunca execute `docker compose down -v`. O atualizador utiliza `prisma db push`; revise alteracoes de schema em ambiente de homologacao antes da producao.
- Limites: editor de modelos inicialmente textual e exportacao DOCX/PDF de texto; a fidelidade de estilos complexos de arquivos importados ainda nao e garantida. Modelos de IA e automacao de Office 365 nao estao implementados.

## SysADV v0.8.1 — identidade DS Advocacia Especializada

A marca visual DS foi incorporada ao login e ao menu lateral; marcas d'água decorativas da Justiça aparecem nas telas internas. A navegação de Modelos Jurídicos foi consolidada em uma única rota `/templates`. O mapeamento de requisitos com base no catálogo público Projuris ADV está em `docs/funcional/PROJURIS_CATALOGO_ADERENCIA_v0.8.1.md`, com distinção explícita entre funcionalidades existentes, parciais e pendentes.

A versão 0.8.1 não substitui o planejamento de refatoração integral dos módulos e não implica equivalência funcional com o Projuris ADV.

## v0.9.2 — Integrações Judiciais

Menu **Integrações Judiciais** (`/integrations`): catálogo de tribunais e órgãos, aprovação de conexões por escritório, fila/worker DJEN, triagem e biblioteca de jurisprudência TJDFT e catálogo CKAN STJ. A liberação de uma conexão é **interna**, não a homologação do tribunal. Ciência eletrônica e peticionamento permanecem **indisponíveis**. DataJud continua bloqueado para fins comerciais.

Consulte [Notas de versão v0.9.2](RELEASE_NOTES_v0.9.2.md) e [Implementação e Homologação](docs/judicial/IMPLEMENTACAO_E_HOMOLOGACAO_v0.9.2.md). O novo serviço Docker `sysadv-judicial-worker` deve estar ativo para processar jobs. As flags de ambiente `JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED` e `JUDICIAL_DJEN_CONTRACT_VALIDATED` têm padrão `false`.

O código foi preparado a partir do fonte v0.9.0 e validado localmente por 135 verificações offline. Dependências, build completo e testes PostgreSQL/external não foram executados no ambiente de preparação. A extensão operacional separada v0.9.1 não foi mesclada.


## v0.9.2-r3 - correcao de compilacao frontend

O tipo `Connection` da pagina de Integracoes Judiciais foi alinhado ao schema Prisma (`tribunal: string | null`) para resolver TS2339 nas linhas de listagem e selecao de conexoes. Antes de atualizar, execute `TESTAR_BUILD_SEM_INSTALAR.bat`. Veja `RELEASE_NOTES_v0.9.2-r3.md`.
