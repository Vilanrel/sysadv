# SysADV v0.5.0 — Judicial Data Gateway — Especificação Técnica

## 1. Objetivo

Evoluir o SysADV de uma integração pontual com o DataJud para uma camada de aquisição de dados judiciais orientada a fontes, com rastreabilidade por campo, precedência, fallback e capacidade de expansão para DJEN, consulta pública/PJe e jurisprudência.

## 2. Princípios

1. Nenhuma fonte externa pode sobrescrever silenciosamente um campo já validado por profissional.
2. Cada valor deve guardar origem, provedor, momento da coleta, referência e estado de validação.
3. DataJud permanece fonte pública estruturada primária para capa e movimentações.
4. DJEN é fonte complementar para publicações, nomes das partes, advogados/OAB e atos publicados, conforme disponibilidade pública.
5. PJe/portais dos tribunais são conectores condicionados à disponibilidade pública, autenticação, convênio e regras do tribunal; não se presume API nacional aberta.
6. Jurisprudência é fonte complementar para decisões/acórdãos e conteúdo decisório disponível publicamente.
7. Documentos enviados ao SysADV + IA permanecem fallback para dados contratuais e parâmetros de cálculo não cobertos por metadados públicos.
8. Falha de telemetria nunca deve invalidar uma consulta externa bem-sucedida.

## 3. Fontes e cobertura

### 3.1 DataJud — DISPONÍVEL

Campos estruturados documentados: número do processo, tribunal, data de ajuizamento, grau, sigilo, formato, sistema, classe, assuntos, órgão julgador, município IBGE, movimentos, complementos e última atualização. O DataJud fornece metadados de processos públicos, capas e movimentações, resguardando processos sigilosos e dados de partes.

### 3.2 DJEN — CONECTOR PREPARADO

Publicações do DJEN devem conter tribunal, órgão julgador, número único, nomes das partes, advogados e OAB; também são publicados despachos, decisões interlocutórias, dispositivo de sentenças, ementas de acórdãos, intimações, distribuição e editais. A v0.5.0 cria contrato de conector, catálogo e proveniência, sem assumir API pública estável não documentada.

### 3.3 PJe / Consulta Pública — CONECTOR PREPARADO

O PJe documenta padrões REST orientados a recursos e autenticação por OAuth2 na arquitetura. A exposição pública e credenciais dependem do tribunal. O SysADV terá contrato de conector e status de disponibilidade, sem scraping automático nesta release.

### 3.4 Jurisprudência — CONECTOR PREPARADO

Conector previsto para decisões, acórdãos, ementas, relator, órgão julgador e datas quando os portais disponibilizarem acesso compatível.

### 3.5 Documentos + IA — FALLBACK

Sentença, acórdão, contracheques e outros documentos alimentam extração de admissão, desligamento, função, salário, verbas, reflexos, juros, correção e parâmetros PJe-Calc.

## 4. Matriz campo × fonte

| Campo | Fonte primária | Fonte secundária | Fallback | v0.5.0 |
|---|---|---|---|---|
| NPU | DataJud/NPU | Tribunal | Manual | Ativo |
| Segmento/Tribunal | NPU + DataJud | Tribunal | Manual | Ativo |
| Classe/Assuntos | DataJud | PJe | Manual | Ativo no Gateway |
| Ajuizamento | DataJud | PJe | Manual | Ativo |
| Órgão julgador/Vara | DataJud | PJe | Manual | Ativo |
| Município | DataJud/IBGE | PJe | Manual | Ativo quando disponível |
| Movimentações | DataJud | PJe | Manual | Ativo |
| Polo ativo/Reclamante | DJEN/PJe | DataJud se exposto | Documento/Manual | Preparado |
| Polo passivo/Reclamado | DJEN/PJe | DataJud se exposto | Documento/Manual | Preparado |
| Advogado/OAB | DJEN/PJe | Portal tribunal | Manual | Preparado |
| Valor da causa | PJe/Portal | Publicação | Documento/Manual | Preparado |
| Sentença/Acórdão | Jurisprudência/PJe/DJEN | Upload | Manual | Preparado |
| Admissão/Desligamento | Documento + IA | Manual | — | Fallback |
| Função/Salário | Documento + IA | Manual | — | Fallback |
| Verbas/Índices/Honorários | Documento + IA | Manual | — | Fallback |

## 5. Arquitetura

```text
NPU
 └─ NpuParser / JudicialSegmentResolver
     └─ JudicialDataGateway
         ├─ DataJudConnector          [ACTIVE]
         ├─ DjenConnector             [PLANNED]
         ├─ PjePublicConnector        [PLANNED]
         ├─ JurisprudenceConnector    [PLANNED]
         └─ DocumentAiConnector       [FALLBACK]
              ↓
         Source Result Normalizer
              ↓
         Field Provenance / Evidence
              ↓
         Merge Policy
              ↓
         LegalProcess
```

## 6. Contratos

### JudicialSourceProvider
- DATAJUD
- DJEN
- PJE_PUBLIC
- JURISPRUDENCE
- DOCUMENT_AI
- MANUAL

### JudicialSourceAvailability
- ACTIVE
- PLANNED
- REQUIRES_AUTH
- REQUIRES_AGREEMENT
- FALLBACK

### JudicialSourceDescriptor
- provider
- label
- availability
- capabilities[]
- publicAccess
- requiresAuthentication
- notes

### JudicialFieldCandidate
- fieldName
- value
- provider
- sourceType
- retrievedAt
- sourceRef/sourceUrl
- reliability
- rawMetadata

## 7. Proveniência

`ProcessFieldEvidence` será ampliado com:
- `provider`
- `sourceRef`
- `sourceUrl`
- `retrievedAt`
- `reliabilityScore`
- `metadata` JSON

A evidência continua usando `sourceType` (OFFICIAL/AI/MANUAL) e `status` (PENDING/VALIDATED/DIVERGENCE).

## 8. Política de merge

1. Campo vazio + candidato oficial → preencher e criar evidência PENDING.
2. Campo existente não validado + valor diferente → atualizar conforme precedência e registrar nova evidência.
3. Campo VALIDATED + valor diferente → preservar campo e registrar DIVERGENCE.
4. Fonte planejada/indisponível → não cria valor sintético.
5. Parte/reclamante/reclamado ausente no DataJud → permanecer PENDING; não inferir.

Precedência inicial por categoria:
- Metadados estruturais: DATAJUD > PJE_PUBLIC > MANUAL.
- Partes/advogados: PJE_PUBLIC/DJEN > DATAJUD quando exposto > MANUAL.
- Conteúdo decisório: JURISPRUDENCE/PJE_PUBLIC/DJEN > DOCUMENT_AI > MANUAL.
- Dados contratuais/cálculo: DOCUMENT_AI > MANUAL.

## 9. API da v0.5.0

- `GET /api/integrations/sources` — catálogo de fontes e capacidades.
- `GET /api/processes/:id/sources` — resumo de proveniência do processo.
- Fluxos DataJud existentes passam a usar `JudicialDataGateway`.
- `GET /api/processes/datajud/search` e `POST /api/processes/:id/datajud/refresh` permanecem compatíveis.

## 10. UI

### Integrações
Nova seção “Fontes Judiciais” exibindo:
- DataJud: Ativo
- DJEN: Conector preparado
- PJe/Consulta Pública: Conector preparado / depende do tribunal
- Jurisprudência: Conector preparado
- Documentos + IA: Fallback

### Processo
Nova seção “Origem dos dados” agrupando evidências por campo/provedor, data de obtenção e status.

## 11. Segurança e LGPD

- API keys e tokens nunca entram em logs/evidências.
- Não persistir payload bruto contendo dados pessoais sem necessidade.
- Respeitar segredo/sigilo retornado pela fonte.
- Apenas dados públicos e acessos autorizados.
- Toda consulta externa auditável por usuário, processo, fonte e finalidade.

## 12. Telemetria

Telemetria é best-effort. Erro ao gravar `IntegrationRequest` deve ser logado, mas não pode transformar resposta externa válida em falha funcional.

## 13. Testes de aceitação

1. Catálogo retorna DataJud ACTIVE e fontes futuras PLANNED/FALLBACK.
2. Consulta DataJud continua resolvendo TJSP, TRT2 e TRF3 por segmento.
3. Evidências DataJud registram provider=DATAJUD e retrievedAt.
4. Campo VALIDATED não é sobrescrito por refresh.
5. Falha de telemetria não impede retorno do DataJud.
6. Processo expõe resumo de fontes por campo.
7. Nenhum segredo aparece em respostas, logs ou artefatos.

## 14. Roadmap

- v0.5.x: Gateway + proveniência + catálogo + DataJud ativo.
- v0.6.x: DJEN, após definição de acesso automatizável compatível com fonte oficial.
- v0.7.x: conectores PJe/tribunais por configuração/autorização.
- v0.8.x: jurisprudência e ingestão decisória.
- v0.9.x: IA documental integrada ao motor de evidências.

## 15. Referências oficiais

- CNJ DataJud API Pública: https://datajud-wiki.cnj.jus.br/api-publica/
- Glossário DataJud: https://datajud-wiki.cnj.jus.br/api-publica/glossario/
- Endpoints DataJud: https://datajud-wiki.cnj.jus.br/api-publica/endpoints/
- Acesso/API Key DataJud: https://datajud-wiki.cnj.jus.br/api-publica/acesso/
- Resolução CNJ 121/2010: https://atos.cnj.jus.br/atos/detalhar/92
- Resolução CNJ 455/2022 compilada / DJEN: https://atos.cnj.jus.br/atos/detalhar/4509
- PJe — Padrões de API: https://docs.pje.jus.br/manuais-basicos/padroes-de-api-do-pje/
- PJe — Arquitetura/OAuth2: https://docs.pje.jus.br/manuais-basicos/arquitetura-pje/
