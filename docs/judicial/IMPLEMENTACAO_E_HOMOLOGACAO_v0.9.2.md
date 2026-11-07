# Implementação SysADV v0.9.2 — Matriz de aderência e evidência

Base documental: *SysADV Documentação Integrações Judiciais v1.0*, 18 páginas, fontes oficiais F01–F33, e pacote técnico enviado pelo solicitante em 06/11/2026. Todos os endpoints externos precisam ser homologados no contexto da instituição responsável; os exemplos não conferem autorização.

## Decisões de segurança

- Todo tenant é derivado exclusivamente do JWT revalidado no servidor, nunca de um `organizationId` fornecido pelo navegador.
- Aprovação de conexão requer permissão `source.manage`, aceite dos termos, hash SHA-256 do contrato, base jurídica e referência da autorização; dados de credenciais não são guardados em campos genéricos.
- `DATAJUD` está bloqueado em cadastro e enriquecimento automáticos. A Portaria CNJ n. 374/2026 proíbe exploração comercial; a habilitação não comercial requer parecer favorável e `JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED=true`, com finalidade `NON_COMMERCIAL_RESEARCH`, sem uso para revenda.
- `DJEN` está desabilitado por padrão. A flag `JUDICIAL_DJEN_CONTRACT_VALIDATED=true` só pode ser configurada após confirmação do OpenAPI integral e do mapeamento de campos em homologação. Conexões permanecem `PENDING` até liberação interna.
- O adaptador HTTP permite somente HTTPS a hosts fixos aprovados, não segue redirecionamentos, verifica JSON e limita respostas em 2 MB. Timeout de 30 segundos; worker com intervalo mínimo de engenharia de 3 segundos entre páginas e até três retentativas para falhas transitórias.
- Leitura interna não é ciência. A rota `/api/comunicacoes/{id}/ciencia` responde HTTP 403 sem consumir serviços externos. Comunicação restrita, petição e ordens judiciais não estão no escopo executável.
- Data/hora da disponibilização, publicação e captura são preservadas separadamente; se a origem trouxer somente data civil, não se fabrica um horário UTC. O valor literal é conservado no snapshot da fonte.
- O banco mantém versões por identificador externo **e hash**, sem apagar a anterior. Jobs só avançam checkpoint na mesma transação da página gravada. Outbox é interno e não significa aviso enviado.

## APIs internas adicionadas (todas exigem autenticação e autorização)

| Método | Rota | Resultado |
|---|---|---|
| GET | `/api/integracoes/fontes` | catálogo e flags efetivas |
| GET | `/api/integracoes/tribunais` | 27 tribunais com aliases documentais |
| GET/POST | `/api/integracoes/conexoes` | conexões do escritório ou criação pendente |
| POST | `/api/integracoes/conexoes/{id}/ativar` | aprovação interna auditada |
| POST | `/api/integracoes/conexoes/{id}/bloquear` | bloquear fonte e jobs pendentes |
| POST | `/api/integracoes/sincronizacoes` | `202` com ID de job DJEN |
| POST | `/api/processos/{id}/sincronizacoes` | `202` com job e vínculo opcional ao processo |
| GET | `/api/integracoes/jobs` e `/api/integracoes/jobs/{id}` | estados e contadores |
| POST | `/api/integracoes/jobs/{id}/retomar` | retomada a partir de checkpoint |
| GET | `/api/integracoes/triagem` | publicações sem processo |
| GET | `/api/integracoes/quarentena` | metadados de respostas inválidas, apenas gestor |
| POST | `/api/publicacoes/{id}/vincular` | vinculação com verificação de NPU e versão |
| POST | `/api/publicacoes/{id}/leitura` | evento de leitura **somente interno** |
| POST | `/api/comunicacoes/{id}/ciencia` | bloqueio explícito 403 |
| POST | `/api/integracoes/jurisprudencia/tjdft/pesquisar` | consulta e biblioteca JurisDF |
| GET | `/api/integracoes/jurisprudencia` | acervo versionado |
| GET | `/api/integracoes/stj/catalogo` | metadados CKAN |
| POST | `/api/integracoes/datajud/consultar` | consulta não comercial com conexão autorizada |
| GET | `/api/integracoes/indicadores` | jobs, pendências, quarentena, outbox |

## Requisitos INT-JUD (12 itens da documentação)

| ID | Status da implementação v0.9.2 | Pendência |
|---|---|---|
| INT-JUD-001 | Código de catálogo e política | revisão jurídica e configuração do cliente |
| INT-JUD-002 | Segregação de tenant na camada API/DB | testes com múltiplos escritórios reais |
| INT-JUD-003 | Adapter DJEN e worker implementados, **bloqueados** | OpenAPI e respostas reais; HML/PRD |
| INT-JUD-004 | Versões, hashes, checkpoint, deduplicação implementados | teste transacional em PostgreSQL |
| INT-JUD-005 | Inscrição alfanumérica+UF e filtros implementados | cobertura real por OAB e tribunal |
| INT-JUD-006 | Não implementado cálculo de prazos | aceite jurídico, calendário e contagem |
| INT-JUD-007 | Consulta DataJud apenas manual, **condicionada** | parecer não comercial e credencial |
| INT-JUD-008 | Domicílio bloqueado por desenho | credenciais, escopos e homologação |
| INT-JUD-009 | Consulta TJDFT e catálogo STJ implementados, **condicionais** | termos e respostas reais, ZIP futuro |
| INT-JUD-010 | Jobs, estados, métricas e quarentena implementados | operação/alertas externos |
| INT-JUD-011 | MNI no catálogo, sem adapter SOAP | WSDL, convênio, credenciais, homologação |
| INT-JUD-012 | TPU no catálogo, importador não implementado | criar catálogo local versionado |

## H01–H18 — Plano de testes

| ID | Evidência preparatória atual | Pendente para aceite |
|---|---|---|
| H01 | Rotas autenticadas e filtragem por organização | executar ataque cruzado em duas organizações reais |
| H02 | Política DataJud coberta nos testes offline | simular credenciais/ambientes sem acessar dados indevidos |
| H03 | Parser exige total e checkpoint por página | captura multipágina com fonte em HML |
| H04 | transação SQL por página e estado parcial | falha injetada após primeira página em PostgreSQL |
| H05 | snapshot por ID e hash | republicação real ou fixture em banco |
| H06 | filtro OAB preserva letras e UF | teste Vitest + HML |
| H07 | Retry-After e backoff implementados | erro 429 artificial controlado |
| H08 | teste offline de HTML 200 aprovado | integração HML |
| H09 | publicação sem vínculo mantida para triagem | teste em banco |
| H10 | conector Domicílio sem execução | credencial expirando após contrato aprovado |
| H11 | ciência explicitamente desabilitada | auditoria de rede provando ausência de chamadas |
| H12 | atos processuais não executáveis | homologação futura de reconciliação |
| H13 | janelas em datas locais literais | cenário com virada UTC/Brasília em HML |
| H14 | ausência de resultados não equivale à inexistência jurídica | aceite de UX e jurídico |
| H15 | schema inesperado falha e conserva payload em quarentena | teste PostgreSQL e XML Fault quando MNI existir |
| H16 | downloads ZIP não implementados | teste malicioso antes de habilitar essa função |
| H17 | script existente gera backup antes de aplicar schema | restauração real do banco, arquivos e hash |
| H18 | unicidade e outbox por chave/hash | testes concorrentes/reprocessamento com PostgreSQL |

**Conclusão:** disponibilidade de código não é homologação. Não há 18 cenários aprovados em ambiente conectado. A suíte de validação offline não substitui a bateria de cenários H01–H18.
