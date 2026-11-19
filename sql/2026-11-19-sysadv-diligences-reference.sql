-- Referencia tecnica. Aplicacao SOMENTE em banco QA apos gerar migracao Prisma.
-- Nao executar manualmente na base principal nem misturar com prisma db push.

CREATE TYPE "DiligenceStatus" AS ENUM ('REQUESTED','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TABLE "Diligence" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "processId" TEXT,
  "correspondentId" TEXT,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "DiligenceStatus" NOT NULL DEFAULT 'REQUESTED',
  "scheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "feeCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Diligence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Diligence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Diligence_processId_fkey" FOREIGN KEY ("processId") REFERENCES "LegalProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Diligence_correspondentId_fkey" FOREIGN KEY ("correspondentId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Diligence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Diligence_organizationId_status_scheduledAt_idx" ON "Diligence"("organizationId","status","scheduledAt");
CREATE INDEX "Diligence_organizationId_correspondentId_idx" ON "Diligence"("organizationId","correspondentId");
