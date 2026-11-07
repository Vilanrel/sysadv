# Judicial Data Gateway v0.5.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduzir gateway de fontes judiciais, proveniência por campo e catálogo de integrações, mantendo DataJud funcional como primeiro conector ativo.

**Architecture:** O `JudicialDataGateway` abstrai conectores e retorna resultados normalizados. `ProcessIntegrationService` deixa de instanciar diretamente `DataJudClient`; evidências registram provedor e metadados. Fontes futuras aparecem no catálogo sem simular coleta.

**Tech Stack:** Node.js 22, TypeScript, Fastify, Prisma/PostgreSQL, React/Vite.

**Spec:** `docs/superpowers/specs/2026-09-18-judicial-data-gateway-design.md`

## Global Constraints
- Não expor API keys/tokens.
- Não sobrescrever campos VALIDATED.
- Telemetria best-effort.
- Manter compatibilidade das rotas DataJud atuais.
- Fontes não implementadas devem aparecer como PLANNED/FALLBACK, nunca produzir dados sintéticos.

### Task 1: Contratos e catálogo de fontes
- Criar `apps/api/src/modules/judicial-data/source-registry.ts`.
- Criar tipos de provedor, disponibilidade e capacidades.
- Testar catálogo e precedência.

### Task 2: Gateway e adaptador DataJud
- Criar `apps/api/src/modules/judicial-data/judicial-data.gateway.ts`.
- Criar `apps/api/src/modules/judicial-data/datajud.connector.ts`.
- Adaptar `ProcessIntegrationService` para usar o gateway.
- Tornar telemetria best-effort.

### Task 3: Proveniência persistente
- Ampliar `ProcessFieldEvidence` no Prisma.
- Registrar provider/retrievedAt/sourceRef/sourceUrl/reliability/metadata em evidências DataJud.

### Task 4: APIs de fontes
- Adicionar `GET /integrations/sources`.
- Adicionar `GET /processes/:id/sources`.

### Task 5: UI
- Mostrar catálogo de fontes em Integrações.
- Mostrar proveniência por campo no detalhe do processo.

### Task 6: Versionamento, documentação e verificadores
- Atualizar para v0.5.0.
- Incorporar especificação técnica à release.
- Atualizar `verify-release.mjs` e scripts de atualização.
