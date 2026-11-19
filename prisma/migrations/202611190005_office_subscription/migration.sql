-- Subscription metadata is read-only from the public API.
-- Does not charge clients, grant permissions, or activate modules without provisioning.
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL','ACTIVE','PAST_DUE','CANCELLED');

CREATE TABLE "OfficeSubscription" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planCode" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "moduleCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enforcementEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "externalCustomerRef" TEXT,
  "externalSubscriptionRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficeSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OfficeSubscription_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OfficeSubscription_organizationId_key" ON "OfficeSubscription"("organizationId");
CREATE INDEX "OfficeSubscription_status_endsAt_idx" ON "OfficeSubscription"("status","endsAt");
