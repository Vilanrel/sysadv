-- Referencia para planejamento de migracao Prisma em banco de homologacao.
-- NAO executar diretamente sobre producao; gerar e revisar migracao Prisma versionada.
-- Dependencia: esquema existente com Organization, Person, OfficeIntake e User.

CREATE TYPE "CrmStage" AS ENUM ('LEAD','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST');

CREATE TABLE "CrmOpportunity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT,
  "intakeId" TEXT,
  "ownerId" TEXT,
  "title" TEXT NOT NULL,
  "stage" "CrmStage" NOT NULL DEFAULT 'LEAD',
  "estimatedCents" INTEGER NOT NULL DEFAULT 0,
  "expectedCloseOn" DATE,
  "notes" TEXT,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmOpportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmOpportunity_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmOpportunity_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CrmOpportunity_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "OfficeIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CrmOpportunity_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CrmOpportunity_organizationId_stage_updatedAt_idx"
  ON "CrmOpportunity"("organizationId","stage","updatedAt");
CREATE INDEX "CrmOpportunity_organizationId_clientId_idx"
  ON "CrmOpportunity"("organizationId","clientId");
CREATE INDEX "CrmOpportunity_organizationId_ownerId_idx"
  ON "CrmOpportunity"("organizationId","ownerId");

-- Depois de aplicar no banco QA via Prisma migrate, executar prisma generate,
-- testes integrados multi-tenant, dump/restore e validar integridade referencial.
