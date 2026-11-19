CREATE TABLE "CrmInteraction" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "opportunityId" TEXT NOT NULL,
 "authorId" TEXT NOT NULL,
 "channel" TEXT NOT NULL DEFAULT 'OTHER',
 "summary" TEXT NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "nextContactAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CrmInteraction_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CrmInteraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CrmInteraction_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CrmInteraction_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CrmInteraction_organizationId_opportunityId_occurredAt_idx"
 ON "CrmInteraction"("organizationId","opportunityId","occurredAt");
