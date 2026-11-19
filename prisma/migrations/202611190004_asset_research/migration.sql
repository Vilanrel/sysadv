-- Registro de pesquisas patrimoniais autorizadas, sem conexao externa automatica.
CREATE TYPE "AssetResearchStatus" AS ENUM ('REQUESTED','AUTHORIZED','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TABLE "AssetResearchRequest" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "processId" TEXT NOT NULL,
 "subjectPersonId" TEXT NOT NULL,
 "requesterId" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "legalBasis" TEXT NOT NULL,
 "authorizationReference" TEXT,
 "status" "AssetResearchStatus" NOT NULL DEFAULT 'REQUESTED',
 "sourceName" TEXT,
 "evidenceReference" TEXT,
 "resultSummary" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AssetResearchRequest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "AssetResearchRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "AssetResearchRequest_processId_fkey" FOREIGN KEY ("processId") REFERENCES "LegalProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "AssetResearchRequest_subjectPersonId_fkey" FOREIGN KEY ("subjectPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "AssetResearchRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AssetResearchRequest_organizationId_status_createdAt_idx" ON "AssetResearchRequest"("organizationId","status","createdAt");
CREATE INDEX "AssetResearchRequest_organizationId_processId_idx" ON "AssetResearchRequest"("organizationId","processId");
