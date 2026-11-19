CREATE TABLE "LegalCitationAttestation" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "reviewerId" TEXT NOT NULL,
 "reference" TEXT NOT NULL,
 "referenceType" TEXT NOT NULL,
 "sourceUrl" TEXT NOT NULL,
 "reviewNotes" TEXT,
 "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "LegalCitationAttestation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "LegalCitationAttestation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "LegalCitationAttestation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "LegalCitationAttestation_organizationId_reviewedAt_idx" ON "LegalCitationAttestation"("organizationId","reviewedAt");
