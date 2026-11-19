-- Consent and generic-email outbox; no outgoing messages unless explicitly enabled.
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING','SENDING','SENT','FAILED','CANCELLED');
ALTER TABLE "User" ADD COLUMN "emailNotificationsOptIn" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE "NotificationEmailDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationEmailDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationEmailDelivery_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationEmailDelivery_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationEmailDelivery_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "NotificationInbox"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationEmailDelivery_notificationId_key" ON "NotificationEmailDelivery"("notificationId");
CREATE INDEX "NotificationEmailDelivery_status_nextAttemptAt_createdAt_idx" ON "NotificationEmailDelivery"("status","nextAttemptAt","createdAt");
CREATE INDEX "NotificationEmailDelivery_organizationId_recipientId_status_idx" ON "NotificationEmailDelivery"("organizationId","recipientId","status");
