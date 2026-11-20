CREATE TABLE "LegalAiSettings" (
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "model" TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
  "encryptedApiKey" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalAiSettings_pkey" PRIMARY KEY ("organizationId"),
  CONSTRAINT "LegalAiSettings_organizationId_fkey" FOREIGN KEY ("organizationId")
   REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
