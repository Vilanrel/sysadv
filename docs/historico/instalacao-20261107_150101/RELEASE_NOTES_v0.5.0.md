# SysADV v0.5.0 — Release Notes

## Judicial Data Gateway
- Nova camada `JudicialDataGateway` para desacoplar o SysADV de uma fonte única.
- DataJud permanece como conector ativo.
- Catálogo preparado para DJEN, PJe/Consulta Pública, Jurisprudência, Documentos+IA e Manual.

## Proveniência por campo
`ProcessFieldEvidence` agora suporta:
- provider
- sourceRef
- sourceUrl
- retrievedAt
- reliabilityScore
- metadata

## Novas APIs
- `GET /api/integrations/sources`
- `GET /api/processes/:id/sources`

## Telemetria
- Gravação de consumo passa a ser best-effort: falha de telemetria não invalida resposta funcional do DataJud.

## Interface
- Menu Integrações exibe catálogo e status das fontes judiciais.
- Detalhe do processo exibe origem, momento da coleta e confiabilidade das evidências.

## Atualização
A atualização usa `prisma db push` para acrescentar os novos campos de proveniência sem remover os dados existentes.
