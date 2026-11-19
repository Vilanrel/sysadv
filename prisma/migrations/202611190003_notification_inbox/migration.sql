-- Caixa de notificacoes internas. Sem envio externo de e-mail, push ou SMS.
CREATE TABLE "NotificationInbox" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "recipientId" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "body" TEXT,
 "sourceType" TEXT NOT NULL,
 "sourceId" TEXT NOT NULL,
 "readAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "NotificationInbox_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "NotificationInbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "NotificationInbox_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationInbox_organizationId_recipientId_sourceType_sou_key"
 ON "NotificationInbox"("organizationId","recipientId","sourceType","sourceId");
CREATE INDEX "NotificationInbox_organizationId_recipientId_readAt_created_idx"
 ON "NotificationInbox"("organizationId","recipientId","readAt","createdAt");
