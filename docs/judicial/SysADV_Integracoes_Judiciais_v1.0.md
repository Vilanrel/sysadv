# Integrações judiciais para o SysADV

Documentação técnica e funcional para implementação de conectores de tribunais e órgãos da Justiça brasileira

Versão 1.0 · 6 de novembro de 2026 · Público destinatário: produto, desenvolvimento, segurança e operação jurídica

## 1 Escopo e decisão de implementação

O SysADV deve integrar as fontes judiciais por conectores independentes, com permissões por escritório e finalidade. A primeira entrega recomendada reúne captura de publicações do DJEN, pesquisa de jurisprudência do TJDFT e ingestão de dados abertos do STJ, após homologação de cada contrato. Domicílio Judicial Eletrônico, datalake CNJ e interfaces MNI entram conforme credenciamento. DataJud fica desabilitado para exploração comercial enquanto não houver enquadramento compatível com as regras vigentes.

Esta documentação especifica chamadas, dados, arquitetura, operação, critérios de aceite e pendências. Não modifica o código do SysADV. Os exemplos são modelos para homologação e não representam conectores já operacionais. Nenhum teste autenticado, protocolo de petição ou registro de ciência foi executado.

Base de produto: a Especificação Funcional SysADV v1.0 prevê Node/Fastify, React/TypeScript, PostgreSQL e arquivos persistentes, além de Conector, Job, Sincronização e EventoExterno. Essa é a arquitetura de referência do documento funcional, não um inventário confirmado do código da versão v0.9.0. [P1]

### 1.1 Restrição que afeta o DataJud

A Portaria CNJ 160/2020, na redação da Portaria 374/2026, limita o consumo a finalidades legais, não comerciais e autorizadas e proíbe a exploração comercial dos dados. Prevê atribuição ao CNJ/DataJud e não assegura completude ou atualização. A norma prevê remessa diária com período de adequação pelos tribunais; isso não comprova atualização diária de cada processo consultado. [F01, F02]

Decisão proposta: o operador do SysADV deve registrar a finalidade e a base de autorização antes de habilitar o conector. Não apresentar a chave pública como licença de exploração comercial. Para um produto comercial, avaliar o acesso autorizado ao datalake ou outra fonte com direitos compatíveis; nenhum desses caminhos tem concessão garantida. [F03, F13, F14]

### 1.2 Níveis de evidência

| Código | Significado | O que permite concluir |
| --- | --- | --- |
| D | Contrato ou serviço descrito em fonte oficial | Há documentação; falta homologação no ambiente do SysADV |
| P | Informação parcial ou acesso condicionado | Exige documento adicional ou credenciamento antes de desenvolver a chamada final |
| H | Integração homologada no ambiente de destino | Somente após evidência de requisição, resposta e autorização; nenhuma recebeu H nesta pesquisa |
| A | Proposta de arquitetura do SysADV | Escolha técnica deste documento, não exigência atribuída ao órgão |

Fontes oficiais foram consultadas diretamente ou por seus conteúdos indexados. Diversos acessos diretos ao CNJ/PDPJ retornaram HTTP 403 nesta sessão; o contrato integral do DJEN e os contratos autenticados não puderam ser recuperados. Ausência de acesso nesta pesquisa não comprova indisponibilidade geral. Todo conector necessita validação de rede, contrato e permissões em homologação.

## 2 Catálogo de integrações e cobertura

| Conector | Uso no SysADV | Acesso e evidência | Limite determinante |
| --- | --- | --- | --- |
| CNJ DataJud | Capa e movimentos públicos | Chave pública; D | Uso comercial vedado nas regras consultadas; não oferece todos os autos [F01–F07] |
| CNJ DJEN | Publicações e certidões | Leitura pública; D/P | Rotas documentadas; filtros e resposta precisam de conferência do OpenAPI integral [F08, F09] |
| Domicílio Judicial Eletrônico | Comunicações dirigidas à instituição | Credenciais e escopos; P | Depende do destinatário autorizado; ciência pode ter efeito processual [F10, F11] |
| MNI por tribunal | Consulta e operações processuais | SOAP, WSDL e habilitação; D/P | Versão, operações e autenticação variam por implantação [F12] |
| PDPJ datalake | Consulta de dados públicos consolidados | Solicitação e aprovação; P | Não equivale à API pública DataJud [F13, F14] |
| TPU e SGT | Classes, assuntos, movimentos e documentos | Serviço e arquivos oficiais; D/P | API exige validar acesso; Excel/SQL são alternativa [F15] |
| TJDFT JurisDF | Pesquisa de decisões e acórdãos | REST com contrato público; D | Jurisprudência, não acompanhamento integral do processo [F16, F17] |
| STJ Dados Abertos | Acervo e corpus de decisões | CKAN e recursos de dados; D | Catálogo/arquivos, não API universal de autos [F18–F20] |
| STF | Dados estatísticos e integração institucional | Downloads; MNI condicionado; D/P | Tratar fora dos aliases documentados do DataJud [F21, F22] |
| OAB CNA | Conferência de inscrição profissional | SOAP com chave; D/P | Publicação do WSDL não concede credencial [F23, F24] |
| TST CNDT | Certidão e validação | Portal oficial; P | API pública de emissão não estabelecida nesta documentação [F25] |
| CNMP BDP MP | Referência institucional de dados do MP | Envio pelos ramos do MP; D | Não é API nacional de consulta liberada ao SysADV [F26] |
| Sisbajud Renajud Infojud | Registro de solicitações e resultados nos processos | Sistemas institucionais; D/P | Não oferecer execução de ordens por escritório privado [F27, F28] |

Cobertura de publicações depende de adesão, períodos, origem e conteúdo de cada tribunal. Consulta vazia não prova inexistência de processo, comunicação ou prazo. A cobertura deverá ser registrada por fonte, tribunal, instância, sistema e intervalo histórico.

## 3 Tribunais estaduais e roteamento nacional

Para consulta de metadados pelo DataJud, usar o catálogo oficial de aliases, mantendo a URL base separada do alias. A tabela abaixo cobre os 26 tribunais estaduais e o TJDFT. É um catálogo documental, sujeito à restrição de uso e à homologação; não significa API própria de cada tribunal nem acesso ao respectivo PJe, eproc ou e SAJ. [F05]

Base: `https://api-publica.datajud.cnj.jus.br`

Rota: `POST /{alias}/_search`

| UF | Tribunal | Alias |
| --- | --- | --- |
| AC | TJAC | api_publica_tjac |
| AL | TJAL | api_publica_tjal |
| AP | TJAP | api_publica_tjap |
| AM | TJAM | api_publica_tjam |
| BA | TJBA | api_publica_tjba |
| CE | TJCE | api_publica_tjce |
| DF | TJDFT | api_publica_tjdft |
| ES | TJES | api_publica_tjes |
| GO | TJGO | api_publica_tjgo |
| MA | TJMA | api_publica_tjma |
| MT | TJMT | api_publica_tjmt |
| MS | TJMS | api_publica_tjms |
| MG | TJMG | api_publica_tjmg |
| PA | TJPA | api_publica_tjpa |
| PB | TJPB | api_publica_tjpb |
| PR | TJPR | api_publica_tjpr |
| PE | TJPE | api_publica_tjpe |
| PI | TJPI | api_publica_tjpi |
| RJ | TJRJ | api_publica_tjrj |
| RN | TJRN | api_publica_tjrn |
| RS | TJRS | api_publica_tjrs |
| RO | TJRO | api_publica_tjro |
| RR | TJRR | api_publica_tjrr |
| SC | TJSC | api_publica_tjsc |
| SP | TJSP | api_publica_tjsp |
| SE | TJSE | api_publica_tjse |
| TO | TJTO | api_publica_tjto |

Para Justiça Federal, Trabalho, Eleitoral e Militar, importar e versionar a relação oficial de aliases; não fabricar rotas por concatenação de siglas. Exemplos documentados: `api_publica_trf1`, `api_publica_trt3`, `api_publica_stj`, `api_publica_tst` e `api_publica_tse`. Não cadastrar `api_publica_stf` por analogia. [F05, F29]

Roteamento proposto: validar a numeração CNJ, usar o tribunal informado e o cadastro de fontes. Os componentes J e TR ajudam a sugerir a origem, mas não devem impedir consulta em outra instância autorizada: recursos e redistribuições exigem conferência. Números antigos e identificadores próprios precisam de campos específicos e conversão assistida.

## 4 Contrato de consulta DataJud

### 4.1 Autenticação e consulta por número

O cabeçalho usa `Authorization: APIKey <chave vigente>`. A chave publicada pode mudar; mantê-la em configuração do servidor, sem copiá-la para este documento ou para o frontend. O exemplo oficial utiliza POST, Query DSL e `match` no campo `numeroProcesso`. [F04, F06]

Modelo de chamada para finalidade previamente autorizada:

```bash
curl --fail-with-body --request POST \
  'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search' \
  --header "Authorization: APIKey ${DATAJUD_API_KEY}" \
  --header 'Content-Type: application/json' \
  --data @consulta-datajud.json
```

```json
{
  "size": 100,
  "query": {
    "match": {"numeroProcesso": "<NUMERO_CNJ_20_DIGITOS>"}
  },
  "sort": [{"@timestamp": {"order": "asc"}}]
}
```

O número é uma string para preservar zeros. Substituir o marcador por um número autorizado; o exemplo não usa dados de cliente real. Conferir igualdade do número retornado após remover apenas a máscara. A consulta pode devolver múltiplos registros de grau ou origem distintos. Não fazer merge destrutivo por número isolado.

### 4.2 Paginação e atualização

O tutorial do CNJ orienta `search_after` com ordenação por `@timestamp`. Reutilizar o array `sort` do último resultado na consulta seguinte, preservando filtros e ordenação. [F07]

Proposta operacional: o cursor só avança após gravação transacional da página. A ordenação não foi estabelecida como snapshot imutável e pode ter empates. Reconciliar janelas sobrepostas e repetir consultas por carteira. Antes de grandes varreduras, homologar desempate suportado e completude; não prometer ingestão sem perdas apenas com um timestamp.

### 4.3 Mapeamento proposto

| Origem DataJud | Destino SysADV | Tratamento |
| --- | --- | --- |
| hits.hits[]._id e _source.id | external_record_id | Preservar os dois quando disponíveis |
| numeroProcesso e tribunal | cnj_number e tribunal_code | String normalizada e origem preservada |
| grau e orgaoJulgador | grau e unidade | Histórico de alteração |
| classe e assuntos | códigos e descrições TPU | Não substituir códigos por rótulos locais |
| movimentos | eventos externos | Normalizar sem perder complementos |
| dataHoraUltimaAtualizacao | source_updated_at | Não confundir com captura |
| @timestamp | source_indexed_at | Cursor técnico da fonte |

Campos e envelopes são descritos no glossário e no exemplo oficial; normalização, histórico e nomes internos são propostas SysADV. Não depender de nomes de pessoas físicas, CPF, OAB ou de documentos integrais nesse conector. Campos de pessoas jurídicas previstos na norma de 2026 devem ser tratados como opcionais até confirmação do schema efetivo. [F01, F06, F30]

## 5 Contrato de captura DJEN

O Swagger oficial distingue leitura pública de operações autenticadas exclusivas dos tribunais. As rotas documentadas incluem consulta, certidão e cadernos. O ambiente de produção é informado pelo CNJ; não usar o login de envio de comunicações como autenticação de escritório. [F08, F09]

| Método | Caminho relativo a /api/v1 | Uso |
| --- | --- | --- |
| GET | /comunicacao | Consultar publicações |
| GET | /comunicacao/{hash}/certidao | Obter certidão da comunicação |
| GET | /comunicacao/tribunal | Consultar tribunais da fonte |
| GET | /caderno/{sigla_tribunal}/{data}/{meio} | Consultar caderno |

Base de produção: `https://comunicaapi.pje.jus.br/api/v1`

Base de homologação publicada: `https://hcomunicaapi.cnj.jus.br/api/v1`

### 5.1 Chamada candidata para homologação

O OpenAPI integral retornou 403 nesta pesquisa. Assim, os filtros a seguir são um modelo a confrontar com a especificação vigente antes de habilitar o conector. Não estão classificados como contrato integralmente validado. Conferir nomes, formatos, enumerações, tamanho da página, totalizadores, limites de consulta e schema da resposta.

```bash
curl --fail-with-body --get \
  'https://comunicaapi.pje.jus.br/api/v1/comunicacao' \
  --header 'Accept: application/json' \
  --data-urlencode "numeroOab=${OAB_NUMERO}" \
  --data-urlencode "ufOab=${OAB_UF}" \
  --data-urlencode 'dataDisponibilizacaoInicio=2026-11-03' \
  --data-urlencode 'dataDisponibilizacaoFim=2026-11-03' \
  --data-urlencode 'pagina=1' \
  --data-urlencode 'itensPorPagina=5'
```

Catálogo de filtros a homologar: número do processo, número e UF da OAB, tribunal e datas de disponibilização. Não eliminar letras de inscrições suplementares; armazenar inscrição original, normalizada e seccional. Nomes de advogados servem como busca auxiliar, sujeitos a homônimos.

### 5.2 Algoritmo proposto de captura

1. Selecionar escritório, profissionais autorizados, tribunais e janela no fuso America/Sao_Paulo.
2. Consultar páginas segundo o contrato homologado; registrar itens recebidos, total quando disponível e término comprovado.
3. Gravar resposta original protegida, normalizar conteúdo, inserir por chave externa e vincular ao processo.
4. Encaminhar publicação sem vínculo seguro para triagem; não descartá-la.
5. Concluir a janela apenas após todas as páginas. Se houver truncamento, particionar por dia e tribunal, ou avaliar cadernos; manter estado incompleto até reconciliação.
6. Reconsultar intervalo sobreposto configurável para capturar republicações e correções, sem duplicar alertas.

Frequência inicial proposta: verificação periódica em fila, com intervalo ajustado ao limite efetivo do servidor, volume e janela operacional. Não fixar uma taxa universal. Respeitar os cabeçalhos de limitação e evitar concorrência excessiva.

### 5.3 Conteúdo e efeitos no produto

Armazenar identificador/hash retornado, tribunal, processo, texto original, texto saneado, destinatários quando fornecidos, data de disponibilização, captura e link de certidão. São campos desejados do domínio: suas chaves externas serão definidas pelo schema homologado.

A leitura interna no SysADV não deve ser chamada de ciência oficial. Publicação, disponibilização, leitura interna, abertura de comunicação restrita e ciência processual são eventos distintos. O módulo de prazos mantém sugestões pendentes de validação profissional, com calendário, tipo de ato e regra de contagem versionados. Não criar um vencimento definitivo somando dias ao timestamp de captura.

## 6 Domicílio Judicial Eletrônico

O Domicílio possui consumo de comunicações por destinatários e registro de ciência, enquanto o serviço de Comunicações Processuais atende ao envio pelos tribunais. O acesso por API para instituições passa por geração/gestão de credenciais; a documentação descreve client e secret, token do SSO e cabeçalho `On-behalf-Of` com CPF do usuário, com onze dígitos. A opção de credenciais é destinada a CNPJs de órgãos públicos e empresas privadas. [F10]

Fluxo de habilitação proposto:

1. Identificar o CNPJ destinatário, administradores e representantes. Não presumir que o CNPJ do fornecedor SysADV autoriza acesso às comunicações dos seus clientes.
2. Realizar cadastro e representação pelos canais oficiais; solicitar a API no GeCli com finalidade e ambiente.
3. Obter o Swagger aplicável à conta aprovada, o token endpoint, audience/scopes e fluxo OAuth efetivamente permitido.
4. Separar credenciais por instituição e ambiente, com rotação, auditoria e vínculo ao responsável.
5. Homologar listagem, paginação, metadados, leitura de conteúdo e efeitos de cada operação, incluindo GETs que possam registrar abertura.

O manual de 2023 apresenta a operação `PUT /api/v1/processos/{numeroProcesso}/comunicacoes/{numeroComunicacao}` para ciência. É referência histórica; o contrato atual precisa ser obtido após habilitação. Não copiar payload, URL base ou fluxo de autenticação de versões antigas sem conferência. [F11, F14]

### 6.1 Separação obrigatória de capacidades

| Capacidade interna | Estado inicial proposto | Condição de liberação |
| --- | --- | --- |
| Listar metadados | Bloqueada até contrato e credencial | Confirmar ausência de efeito de ciência |
| Abrir conteúdo | Ação explícita após homologação | Mapear efeito jurídico, perfil e instituição |
| Registrar ciência | Desabilitada na primeira entrega | Responsável autorizado e confirmação contextual |
| Enviar comunicação como tribunal | Fora do escopo do escritório | Apenas perfil institucional habilitado |

Ações com efeito processual não podem executar por robô de pré visualização, cache warmer ou coleta genérica. Se o resultado for incerto após timeout, registrar operação pendente de reconciliação e consultar o estado oficial antes de qualquer repetição. Leitura automática só é aceitável quando o efeito da operação tiver sido verificado e autorizado.

## 7 MNI e sistemas locais dos tribunais

O MNI é um padrão de interoperabilidade, usualmente SOAP, e não uma API pública única. A página do CNJ para integração do Escritório Digital descreve a versão 2.2.2 e operações como `consultarAvisosPendentes`, `consultarTeorComunicacao` e `consultarProcesso`. A disponibilidade concreta depende do serviço e da habilitação. [F12]

Ficha obrigatória de cada adaptador: tribunal, sistema, grau, ambiente, URL HTTPS aprovada, WSDL/XSD versionados e seus hashes, operações permitidas, forma de autenticação, assinatura, anexos e limites de tamanho, suporte, validade da habilitação e casos de homologação.

Procedimento técnico proposto: gerar cliente a partir do WSDL aceito; desabilitar resolução de entidades externas no parser XML; configurar SOAPAction e namespaces conforme o binding; tratar SOAP Fault mesmo quando HTTP for 200; não registrar senhaConsultante, tokens ou peças em logs. A licença de acesso de um usuário não deve ser convertida em credencial compartilhada entre escritórios.

### 7.1 Consultas e peticionamento

Separar consulta de petição inicial/intercorrente, juntada, ciência e recebimento de avisos. Peticionamento exige validação de documento, representação, assinatura, permissões e recibo oficial. Não repetir uma submissão de resultado desconhecido sem reconciliar o protocolo. O serviço mni-client do PJe possui documentação REST própria, mas sua existência não prova liberação para o SysADV. [F31]

### 7.2 Casos concretos

STF: a orientação institucional informa MNI 2.2.2, termo de adesão, contato de integração e WSDL de produção em `https://ws.stf.jus.br/servico-intercomunicacao-2.2.2/intercomunicacao?wsdl`. A página é direcionada a órgãos; a elegibilidade do SysADV precisa ser confirmada. Não usar endpoints HTTP de testes citados na página para tráfego sensível. [F22]

TJSP: existe documentação de integração webservice para execução fiscal de procuradorias, dependente de convênio. Isso não comprova acesso geral de escritórios. A documentação de eproc destinada a usuários externos comprova fluxos de portal, não uma API genérica autorizada. Selecionar sistema e competência por processo, considerando coexistência de plataformas. [F32, F33]

Para PJe, eproc, e SAJ e Projudi em outros tribunais, o backlog deve começar pela solicitação formal do contrato e das condições de uso. Não inventar rotas como `/api/processos` a partir da existência da tela pública.

## 8 Datalake CNJ e tabelas processuais

### 8.1 Acesso autorizado ao datalake

A Portaria 316/2024 disciplina dados judiciais públicos consolidados: a admissão de entidades públicas ou privadas é condicionada, inclui requisitos de proteção, infraestrutura e auditoria e exclui dados restritos ou potencialmente sensíveis conforme a própria norma. A documentação GeCli descreve solicitação, finalidade, CNPJ e análise para APIs, incluindo Consulta de Processos Públicos no Datalake. Não há aprovação automática por possuir conta no Jus.br. [F13, F14]

Entregáveis para requerer acesso: identificação da instituição, descrição do SysADV e da finalidade, arquitetura, categorias de dados, segregação de usuários, controle de acesso, retenção, trilha de auditoria, contato técnico e documentos exigidos pelo catálogo. Conferir também condições de oferta do produto ao Judiciário, quando aplicáveis.

O host, rotas, scopes, paginação, quotas e políticas do conector ficam pendentes do contrato liberado. Não substituir essa pendência por URLs inferidas de ferramentas de terceiros. Acesso ao datalake não implica acesso irrestrito a petições ou autos sigilosos.

### 8.2 TPU e SGT

O CNJ mantém tabelas de classes, assuntos, movimentos e documentos. Há API e distribuição de versões em arquivos, incluindo Excel/SQL; a documentação PDPJ aponta serviço próprio para consulta. [F15]

Implementação proposta: catálogo local versionado com código, nome, hierarquia, ramo, vigência, situação e origem. Importar nova versão em staging, validar referências e publicar atomicamente. Não excluir código histórico removido: mantê-lo inativo para consultas antigas. O adapter da API só será definido após conferir o Swagger e o acesso efetivo; arquivos oficiais permitem iniciar a normalização sem presumir acesso ao gateway PDPJ.

## 9 Jurisprudência TJDFT e dados abertos STJ

### 9.1 TJDFT

O TJDFT publica contrato REST para jurisprudência em `POST https://jurisdf.tjdft.jus.br/api/v1/pesquisa`. Os campos obrigatórios são `query`, `pagina` iniciando em zero e `tamanho`; `termosAcessorios` admite filtros por campo e valor. [F16, F17]

```bash
curl --fail-with-body --request POST \
  'https://jurisdf.tjdft.jus.br/api/v1/pesquisa' \
  --header 'Content-Type: application/json' \
  --data '{"query":"dano moral","pagina":0,"tamanho":10}'
```

A resposta documentada contém `hits`, `registros`, `agregações` e `paginação`. O exemplo inclui `uuid`, `identificador`, `processo`, `ementa`, `inteiroTeor`, `dataPublicacao` e `possuiInteiroTeor`. Homologar filtros e disponibilidade efetiva de conteúdo antes de expor o recurso. [F17]

Proposta SysADV: indexar resultado pelo UUID e versão, preservar a fonte e o link, distinguir ementa de inteiro teor, registrar a data de captura e vincular decisões à biblioteca de pesquisa. Não inserir cada resultado como andamento do processo do cliente. Sanitizar HTML ao renderizar texto.

### 9.2 STJ

O portal oficial permite acesso automatizado via CKAN. O conjunto de íntegras de decisões terminativas e acórdãos possui metadados JSON, textos em ZIP e dicionário CSV, com arquivos diários referentes à publicação anterior. O corpus é selecionado e não equivale a todos os documentos de todos os processos. [F18, F19]

Chamada derivada do padrão CKAN publicado pelo portal, a homologar no host STJ:

```bash
curl --fail-with-body --get \
  'https://dadosabertos.web.stj.jus.br/api/3/action/package_search' \
  --data-urlencode 'q=acordaos' \
  --data-urlencode 'rows=5'
```

Consultar depois `package_show?id=<id_retornado>` e baixar recursos aprovados de `result.resources`. Verificar `success` no JSON mesmo com HTTP 200; o padrão CKAN pode representar falha no corpo. Não pressupor que cada arquivo esteja no DataStore. [F20]

Proposta de ingestão: manter manifesto por recurso, tamanho, hash, data e versão; suportar reprocessamento e arquivos substituídos. Validar URL de download e redirecionamentos, limites de expansão ZIP, caminhos internos e tipo MIME. Não executar arquivos extraídos.

## 10 Órgãos relacionados e limites do escopo

| Fonte | O que foi estabelecido | Requisito proposto no SysADV |
| --- | --- | --- |
| STF Corte Aberta | Bases estatísticas para download em formatos abertos [F21] | Importador de bases e dicionários; contrato separado do MNI |
| OAB CNA | SOAP ConsultaAdvogado com Authentication Key e SOAPAction próprios [F23] | Cadastro de profissionais com verificação condicionada a chave autorizada |
| OAB convênios | Há compartilhamento institucional do CNA mediante cooperação [F24] | Solicitar elegibilidade; não presumir fornecimento a software privado |
| TST CNDT | Portal de emissão e validação [F25] | Link oficial, upload da certidão e registro de validade; API só após contrato oficial |
| CNMP BDP MP | Padronização e envio de dados pelos ramos do MP [F26] | Não implementar cliente nacional de consulta a partir do manual de envio |
| Sisbajud | Intermediação de ordens judiciais financeiras [F27] | Controlar pedidos e documentos juntados; não executar bloqueios |
| Renajud e Infojud | Serviços voltados ao Judiciário, com perfis próprios [F28] | Registrar resultados autorizados no processo, sem conceder poderes institucionais |
| MPF MPE DPU DPE AGU PGE e cartórios | Contratos de consulta não estabelecidos neste catálogo | Criar descoberta específica por órgão, finalidade e elegibilidade |

### 10.1 Referência técnica OAB

O serviço documenta `POST https://www5.oab.org.br/cnaws/service.asmx`, SOAP 1.1 e `SOAPAction: "http://tempuri.org/ConsultaAdvogado"`. O cabeçalho XML `Authentication` contém `Key`; o corpo possui `inscricao`, `uf` e `nome`; o resultado é uma string XML. Não confundir o cabeçalho SOAP com um bearer token HTTP. [F23]

Exemplo estrutural, somente após obtenção de chave e autorização:

```xml
<soap:Envelope
 xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
 <soap:Header>
  <Authentication xmlns="http://tempuri.org/">
   <Key>CHAVE_AUTORIZADA</Key>
  </Authentication>
 </soap:Header>
 <soap:Body>
  <ConsultaAdvogado xmlns="http://tempuri.org/">
   <inscricao>INSCRICAO_AUTORIZADA</inscricao>
   <uf>UF</uf><nome></nome>
  </ConsultaAdvogado>
 </soap:Body>
</soap:Envelope>
```

A coleção técnica não inclui pedido de ciência, peticionamento ou bloqueio. Essas operações precisam de homologação própria, além de requisitos funcionais e jurídicos específicos.

## 11 Arquitetura proposta para o SysADV

A interface solicita uma sincronização à API do SysADV. A API aplica autenticação e autorização, grava um job e responde sem esperar a fonte externa. Um worker seleciona o conector, aplica limites e credenciais, captura, valida, normaliza e persiste os eventos. A camada de domínio associa os eventos a processos e cria pendências de triagem ou notificações.

| Camada | Responsabilidade | Restrição |
| --- | --- | --- |
| React TypeScript | Configurações, situação e triagem | Sem credenciais judiciais no navegador |
| Node Fastify | RBAC, tenant, contratos internos | Nunca aceitar tenant livre do payload como autorização |
| Worker | Filas, cursores, backoff e reconciliação | Respeitar quotas globais e por credencial |
| Adapter por fonte | Autenticação, protocolo e schema | Sem misturar credenciais ou efeitos de operações |
| Domínio | Processo, publicação, evento e prazo | Identidade externa e proveniência obrigatórias |
| PostgreSQL | Metadados, histórico, jobs e outbox | Transações, unicidade e isolamento |
| Arquivos persistentes | Respostas e documentos permitidos | Criptografia, hash e permissão por escritório |

Contrato lógico dos adapters, sem pressupor uma implementação existente:

```typescript
type Capability =
  | 'searchPublications' | 'searchProcesses'
  | 'searchDecisions' | 'listCommunications'
  | 'readCommunication' | 'acknowledge';

interface JudicialConnector {
  code: string;
  capabilities: Capability[];
  effectOf(operation: Capability):
    'none' | 'mayAcknowledge' | 'submitsAct' | 'unknown';
  execute(context: AuthorizedContext,
    request: ValidatedRequest): Promise<ConnectorResult>;
}
```

Tipos internos são ilustrativos. Contexto deve incluir escritório, ator, instituição representada, ambiente, referência de credencial, finalidade autorizada e correlationId. Operação com efeito desconhecido é bloqueada em jobs automáticos.

Não há pressuposto de webhook universal. Começar por polling controlado. Implementar webhook apenas quando documentado pela fonte e autorizado, com autenticação, validação de assinatura quando prevista, deduplicação e reprocessamento.

## 12 Dados normalizados e persistência

### 12.1 Entidades mínimas propostas

| Entidade | Campos ou regras essenciais |
| --- | --- |
| integration_sources | código, tipo, capacidades, contrato/hash, versão, termos, estado |
| integration_connections | tenant, fonte, instituição, ambiente, tribunal, finalidade, autorização, credential_ref |
| integration_jobs | tenant, conexão, filtros, janela, cursor, status, tentativas, próximo disparo |
| external_records | tenant, conexão, namespace, external_id, versão, hashes, captura e origem |
| judicial_events | processo, fonte, data do fato, texto, código TPU, situação de vínculo |
| publications | evento, publicação original, disponibilização, destinatários, revisão |
| communication_actions | comunicação, efeito, ator, solicitação, estado, recibo e reconciliação |
| artifact_manifests | tenant, storage_key, MIME, tamanho, SHA 256, versão, retenção |
| integration_outbox | evento persistido, destinatário interno, chave de notificação, envio |

Unicidade base: `(tenant_id, connection_id, namespace, external_id)`. Para versões, acrescentar a versão da fonte quando existente ou guardar snapshots por hash sem apagar a anterior. Nem hash de texto nem número CNJ isolado é identificador suficiente para todas as fontes.

### 12.2 Identidade e deduplicação

Dar preferência ao identificador estável do provedor. Em movimentos sem ID, usar impressão composta por processo, tribunal, grau, código, instante original e complementos normalizados, preservando o payload original e possíveis colisões para análise. Um mesmo código e horário pode representar fatos distintos; a impressão é heurística, não prova de igualdade.

Correção ou republicação gera uma nova versão ou relação explícita com a anterior. Não descartar publicação pelo simples fato de o texto ser parecido. Respostas de fontes diferentes permanecem distintas, mesmo quando se referem ao mesmo processo; a visão consolidada não elimina proveniência.

### 12.3 Timestamps e vínculos

Manter separadamente `event_at`, `made_available_on`, `published_on`, `source_updated_at`, `fetched_at`, `internal_read_at` e `official_acknowledged_at`, quando existirem. Datas sem hora continuam como datas; não inventar meia noite UTC. Preservar o fuso e o valor bruto quando a interpretação estiver pendente.

Vincular automaticamente apenas por processo e contexto inequívocos. Homônimos, processos múltiplos ou inscrição sem UF vão para triagem. A captura pode ser tecnicamente concluída e manter registros ainda não vinculados; o painel mostra as duas situações.

## 13 Contratos internos propostos

As rotas abaixo pertencem ao SysADV. Não são endpoints dos tribunais nem declaração de funcionalidade já implementada. Todas usam sessão autorizada e escopo de escritório derivado da identidade autenticada.

| Método e rota | Entrada | Saída ou regra |
| --- | --- | --- |
| GET /api/integracoes/fontes | Filtros opcionais | Catálogo com capacidades e elegibilidade |
| POST /api/integracoes/conexoes | fonte, ambiente, instituição, credentialRef | Conexão inicialmente pendente |
| POST /api/integracoes/conexoes/{id}/validar | Operação de diagnóstico permitida | Resultado sem efeitos processuais; se não houver, validação manual |
| POST /api/processos/{id}/sincronizacoes | conexão e janela limitada | 202 com jobId e statusUrl |
| GET /api/integracoes/jobs/{id} | Identificador autorizado | Estado, contadores, falhas e próxima tentativa |
| GET /api/publicacoes | Situação, processo e período | Paginação interna e fonte |
| POST /api/publicacoes/{id}/vincular | processoId e versão esperada | Vínculo auditado |
| POST /api/publicacoes/{id}/leitura | Ato interno | Não chama ciência externa |
| POST /api/comunicacoes/{id}/ciencia | Confirmação e responsável | Somente em fase habilitada, com reconciliação |

Requisições que criam jobs ou atos aceitam `Idempotency-Key`, armazenada com hash do pedido. Mesma chave com conteúdo diferente retorna conflito. Consultar status deve retornar 404/403 conforme política sem revelar objetos de outro tenant.

Envelope interno de resultado proposto:

```json
{
  "jobId": "<uuid>",
  "status": "partial",
  "completeness": "unknown",
  "received": 20,
  "inserted": 12,
  "updated": 3,
  "duplicates": 5,
  "unlinked": 2,
  "source": "DJEN",
  "lastSuccessfulFetchAt": "<iso8601>",
  "warnings": ["WINDOW_NOT_RECONCILED"]
}
```

Contadores medem categorias documentadas pelo worker; `unlinked` é subconjunto e não entra na soma recebido/inserido/atualizado/duplicado. Uma falha de página impede `completeness=complete`.

## 14 Sincronização e tratamento de falhas

Estados propostos para jobs: queued, running, retry_wait, partial, succeeded, failed, blocked e cancelled. As ações processuais possuem estados próprios: prepared, submitted, confirmed, outcome_unknown e reconciled. Não reaproveitar succeeded para uma ciência sem recibo ou confirmação oficial.

| Situação | Tratamento proposto | O que o usuário vê |
| --- | --- | --- |
| 400 ou schema inválido | Interromper e corrigir contrato/filtro | Integração requer ajuste |
| 401 | Renovar token uma vez se previsto; depois bloquear | Credencial expirada ou inválida |
| 403 | Verificar autorização, escopo e política de rede | Acesso não autorizado ou bloqueado |
| 404 | Conferir rota ou ausência conforme contrato | Diferenciar fonte inexistente de registro ausente |
| 429 | Respeitar Retry After quando presente e limite da fonte | Nova tentativa agendada |
| 5xx ou timeout de consulta sem efeito | Retentativa limitada com backoff e jitter | Fonte indisponível e última captura válida |
| Timeout de operação com efeito | Outcome unknown; reconciliar antes de repetir | Resultado oficial pendente |
| 200 com HTML, login ou erro no corpo | Falha de contrato; não tratar como lista vazia | Consulta não concluída |
| Página vazia antes do total | Suspeita de incompletude | Captura parcial |
| Schema mudou | Quarentena do payload e alerta | Conector suspenso para revisão |

Parâmetros iniciais de engenharia, ajustáveis após medição: timeout de consulta de 30 segundos; até 3 retentativas para leitura sem efeito; backoff exponencial com jitter; uma execução ativa por conexão e janela. Downloads usam limites próprios de tempo e tamanho. Esses valores não são quotas dos tribunais.

Checkpoint e registros de uma página devem ser gravados juntos. Se o processo cair após persistir os dados e antes de notificar, o outbox permite retomar avisos sem repetir captura. Não avançar a data global porque uma única OAB ou tribunal concluiu o processamento.

Métricas: idade da última captura bem sucedida, janelas pendentes, latência, 401/403/429, itens não vinculados, duplicações, alterações de schema e ações de resultado desconhecido. O health do SysADV pode estar saudável com uma fonte judicial degradada; o painel precisa expor essa distinção.

## 15 Segurança e operação jurídica

Aplicar autorização no backend e isolamento por tenant em dados, cache, arquivos e jobs. O token de uma instituição não deve autorizar leitura de outra, ainda que ambas usem o mesmo operador do SysADV. Usar referências de segredo em cofre, criptografia de binários e acesso temporário autorizado aos documentos.

Não registrar tokens, senhas, certificados, CPF integral ou conteúdo de peças em logs gerais. Guardar trilha com ator, tenant, instituição representada, finalidade, fonte, operação, instante, resultado, ID externo e correlationId. Segredos e payloads integrais ficam em áreas com controle de acesso próprio.

Registrar categorias de dados, finalidade, base legal aplicável, retenção, responsáveis e atendimento a titulares com o jurídico. Dados públicos não devem ser tratados automaticamente como dados de livre exploração comercial. Rever termos de cada fonte antes da ativação e em alterações materiais.

A camada HTTP deve permitir apenas hosts aprovados; redirecionamentos de download também passam pela validação. Proibir acesso a endereços privados, loopback e metadata de nuvem; sanitizar HTML; limitar JSON/XML, anexos e expansão ZIP. O parser SOAP deve bloquear XXE e entidades externas.

Regras de ciência e prazo exigem aceite funcional: distinguir leitura interna de ato no órgão, exibir instituição e processo antes do ato, conferir representação, guardar evidência e prever reconciliação. Não enviar a IA externa documentos ou dados capturados sem política e autorização próprias.

Backup deve restaurar banco, manifestos, binários e referências de credenciais de maneira consistente. Segredos seguem procedimento próprio de recuperação e rotação. Não usar diretórios efêmeros de container como única cópia dos documentos.

## 16 Requisitos rastreáveis e homologação

### 16.1 Backlog de integração

| ID novo | Entrega | Referência funcional SysADV | Aceite principal |
| --- | --- | --- | --- |
| INT JUD 001 | Catálogo e elegibilidade | RF PUB 001 | Fonte bloqueada sem contrato/finalidade compatível |
| INT JUD 002 | Isolamento de credenciais | RF SEG 001 e 004 | Tentativa entre escritórios é negada |
| INT JUD 003 | Adapter DJEN | RF PUB 002 e 003 | Todas as páginas e pendências preservadas |
| INT JUD 004 | Idempotência e versões | RF AND 001 e 002 | Reprocessamento não duplica fatos ou alertas |
| INT JUD 005 | Monitoramento por OAB | RF AND 003 | Inscrição e UF preservadas; cobertura visível |
| INT JUD 006 | Prazo revisável | RF PUB 005 | Sem prazo definitivo sem validação |
| INT JUD 007 | Adapter DataJud condicionado | RF PRO 005 | Restrição comercial aplicada antes de consumir |
| INT JUD 008 | Domicílio segregado | RF PUB 004 | Ciência não ocorre na coleta automática |
| INT JUD 009 | Jurisprudência | Módulos Processos e Documentos | TJDFT/STJ separados dos andamentos |
| INT JUD 010 | Operação e observabilidade | RNF 09 e 10 | Painel diferencia vazio, falha e parcial |
| INT JUD 011 | MNI por tribunal | RF PUB 001 e RF AND 001 | WSDL e permissões homologados por destino |
| INT JUD 012 | TPU versionada | RF PRO 001 | Códigos históricos continuam consultáveis |

Os códigos da especificação original usam hífens, por exemplo RF-PUB-001 e RF-AND-002; a tabela abrevia visualmente as famílias. Requisitos novos são propostas, não funcionalidades confirmadas da versão instalada. [P1]

### 16.2 Cenários mínimos de teste

| ID | Cenário | Resultado esperado |
| --- | --- | --- |
| H01 | Tenant A tenta usar conexão B | Negado sem expor segredo ou dados |
| H02 | Job DataJud em finalidade comercial | Bloqueado pela política configurada |
| H03 | Retorno de mais de uma página | Completude só após término validado |
| H04 | Falha na segunda página | Cursor seguro, job parcial e retomada |
| H05 | Republicação com mesmo processo | Versão preservada, sem descarte por similaridade |
| H06 | OAB com letra e mesma inscrição em outra UF | Sem colisão entre profissionais |
| H07 | Fonte retorna 429 | Aguardar limite; não criar loop concorrente |
| H08 | Resposta 200 contém tela de login | Falha de contrato, não zero resultados |
| H09 | DJEN traz processo não cadastrado | Pendência de triagem visível |
| H10 | Expira credencial do Domicílio | Bloqueio e aviso ao responsável |
| H11 | Pré visualização de comunicação | Nenhuma ciência ou abertura com efeito sem autorização |
| H12 | Timeout após ciência/petição | Reconciliação antes de repetir |
| H13 | Virada de dia entre UTC e Brasília | Janela segue data local configurada |
| H14 | Resultado vazio para processo conhecido | Ausência na fonte; não inexistência jurídica |
| H15 | Mudança do schema ou XML Fault | Quarentena e mensagem operacional |
| H16 | ZIP com caminho malicioso ou expansão excessiva | Download/extração rejeitados |
| H17 | Restauração de banco e binários | Hashes e vínculos consistentes |
| H18 | Reprocessamento de job concluído | Sem duplicar dados nem notificações |

Evidência por conector: versão do contrato, ambiente, elegibilidade, filtros, requisição redigida, status/headers, resposta redigida, contadores, prova de paginação, tratamento de erro e autorização do responsável. Testes de ciência e petição devem usar apenas ambiente e cenários expressamente liberados pelo órgão.

## 17 Sequência recomendada e pendências

| Etapa | Entregas | Dependência para concluir |
| --- | --- | --- |
| 1 Fundação | Fontes, credenciais, jobs, auditoria, arquivos e outbox | Inventário do código atual e migrações |
| 2 Fontes públicas | DJEN, TJDFT e STJ | OpenAPI DJEN, testes de rede/schema e termos |
| 3 Domínio jurídico | Triagem, vínculo, alertas e prazo sugerido | Aceite do responsável jurídico e calendários |
| 4 Acessos condicionados | Domicílio, datalake e CNA | Aprovação, credenciais e escopos por instituição |
| 5 Tribunais específicos | MNI e outros contratos oficiais | Convênio, WSDL e homologação por tribunal |
| 6 Atos processuais | Ciência e eventual peticionamento | Permissões, revisão funcional e reconciliação |

Priorizar o TJSP como piloto de cobertura estadual, se ele corresponder à carteira do escritório, e o TJDFT como piloto técnico de jurisprudência. A escolha de carteira não foi informada; antes da implantação selecionar tribunais, graus, sistemas, quantidade de processos e OABs.

Pendências concretas: confirmar uso interno ou comercial do SysADV; obter o OpenAPI integral DJEN vigente; validar resposta e filtros da consulta; obter autorizações do CNPJ destinatário no Domicílio; solicitar acesso datalake no GeCli se pertinente; conferir termos/licenças de datasets STJ; decidir conectores locais por carteira; medir volume e metas de operação; homologar efeito de abertura de comunicações antes de automatizá-las.

Conclusão técnica: uma integração nacional deve combinar fontes com capacidades distintas. O desenho suporta consultas públicas e acessos institucionais sem presumir que uma API única ofereça autos, publicações, ciência e peticionamento em todos os tribunais.

## 18 Referências e registro de pesquisa

Consultadas em 06/11/2026. Os links são oficiais; descrições referem-se ao conteúdo recuperado nesta pesquisa. D não equivale a teste de integração em produção. A lista não constitui inventário exaustivo de todos os serviços judiciais brasileiros.

| ID | Fonte oficial | Evidência utilizada |
| --- | --- | --- |
| F01 | https://atos.cnj.jus.br/atos/detalhar/6972 | Portaria 374 de 2026 e restrições de consumo |
| F02 | https://atos.cnj.jus.br/atos/detalhar/3453 | Portaria 160 de 2020 compilada |
| F03 | https://datajud-wiki.cnj.jus.br/api-publica/termo-uso/ | Condições de uso DataJud |
| F04 | https://datajud-wiki.cnj.jus.br/api-publica/acesso/ | Chave pública e cabeçalho |
| F05 | https://datajud-wiki.cnj.jus.br/api-publica/endpoints/ | Aliases de consulta por tribunal |
| F06 | https://datajud-wiki.cnj.jus.br/api-publica/exemplos/exemplo1/ | POST por número e envelope de resposta |
| F07 | https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf | Paginação search_after |
| F08 | https://hcomunicaapi.cnj.jus.br/swagger/index.html | Rotas e distinção entre leitura e envio DJEN |
| F09 | https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/comunicacoes-processuais/orientacoes-aos-tribunais/ | Ambientes e integração de envio |
| F10 | https://docs.pdpj.jus.br/servicos-negociais/domicilio-judicial-eletronico/ | Credenciais, papéis e auditoria de chamadas |
| F11 | https://www.cnj.jus.br/wp-content/uploads/2023/02/manual-usuario-domicilio-judicial-eletronico-rev1.pdf | Referência histórica da operação de ciência |
| F12 | https://www.cnj.jus.br/integracao-para-os-tribunais/ | MNI e operações de consulta |
| F13 | https://atos.cnj.jus.br/atos/detalhar/5792 | Portaria 316 de 2024 e acesso ao datalake |
| F14 | https://docs.pdpj.jus.br/servicos-negociais/GeCli/ | Solicitação, análise e liberação de APIs |
| F15 | https://www.cnj.jus.br/programas-e-acoes/tabela-processuais-unificadas/ | TPU, API e arquivos de versões |
| F16 | https://www.tjdft.jus.br/transparencia/tecnologia-da-informacao-e-comunicacao/dados-abertos/webservice-ou-api | API pública de jurisprudência |
| F17 | https://www.tjdft.jus.br/transparencia/tecnologia-da-informacao-e-comunicacao/dados-abertos/documentos/documentacao_api_seti_transparencia.pdf | Contrato JurisDF em três páginas |
| F18 | https://dadosabertos.web.stj.jus.br/ | Catálogo e referência CKAN |
| F19 | https://dadosabertos.web.stj.jus.br/dataset/integras-de-decisoes-terminativas-e-acordaos-do-diario-da-justica | Conteúdo e atualização do corpus |
| F20 | https://docs.ckan.org/en/2.9/api/ | Action API, package_search/show e erros no corpo |
| F21 | https://noticias.stf.jus.br/postsnoticias/corte-aberta-reune-dados-do-stf-em-paineis-interativos-e-bases-para-download/ | Bases estatísticas abertas do STF |
| F22 | https://cms.stf.jus.br/post-processos/como-se-integrar-orgao/ | Adesão, homologação e WSDL STF |
| F23 | https://www5.oab.org.br/cnaws/service.asmx?op=ConsultaAdvogado | Envelope SOAP e Authentication Key |
| F24 | https://www.oab.org.br/util/print/60874?print=Noticia | Cooperação institucional para CNA |
| F25 | https://cndt-certidao.tst.jus.br/ | Emissão e validação de CNDT pelo portal |
| F26 | https://www.cnmp.mp.br/portal/publicacoes/19244-manual-de-envio-de-dados-bdp-mp | BDP MP como fluxo de envio institucional |
| F27 | https://www.cnj.jus.br/sisbajud/ | Finalidade e funções do Sisbajud |
| F28 | https://www.cnj.jus.br/sistemas/informacoes-sobre-bens-e-pessoas/ | Renajud e Infojud |
| F29 | https://portal.trt3.jus.br/internet/transparencia/tecnologia-da-informacao/dados-api/datajud | Endpoint DataJud TRT3 |
| F30 | https://datajud-wiki.cnj.jus.br/api-publica/glossario/ | Estrutura de campos DataJud |
| F31 | https://mni-client.prd.cnj.cloud/swagger-ui/index.html | Adapter REST MNI do ecossistema PJe |
| F32 | https://www.tjsp.jus.br/ProcessoDigitalExecFiscalProc | Integração de procuradorias por convênio |
| F33 | https://portal.tjsp.jus.br/eproc/ManuaisTutoriais | Manuais eproc de públicos externos |

P1 — SysADV Especificação Funcional v1.0, documento interno de 06/11/2026, seções 3.5 a 3.8 e 6.1 a 6.4. Utilizado para o alinhamento dos requisitos; não comprova implementação no código.

### 18.1 Situação dos exemplos anexos

A coleção Postman inclui modelos de consulta DataJud, rotas de leitura DJEN, pesquisa TJDFT e catálogo STJ. Os exemplos são sem dados reais e sem segredos. DJEN exige a variável `contrato_djen_validado=true`; DataJud exige `uso_datajud_autorizado=true`. Essas flags evitam execução acidental, mas não substituem a análise nem concedem autorização. Não executar a coleção inteira antes de configurar cada fonte. As flags refletem controles de preparação, não conformidade jurídica automática.

O mapa CSV dos tribunais contém aliases documentais do DataJud e estado de homologação pendente. O manifesto JSON de fontes diferencia rotas documentadas de contratos pendentes. Todos esses artefatos são material de implementação; a homologação deverá produzir evidência adicional antes de qualquer alegação de cobertura operacional.
