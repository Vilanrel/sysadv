-- SysADV v0.10.1 -- DDL de REFERENCIA para PostgreSQL 16.
-- Nao aplicar sem backup, teste de restauracao e comparacao com Prisma.
-- Para ambientes gerenciados por Prisma, gerar migracao versionada e revisar
-- o SQL antes de rodar; nao executar este arquivo E prisma db push no mesmo banco.
BEGIN;
CREATE TABLE IF NOT EXISTS "DeadlineRule" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "code" TEXT NOT NULL, "version" INTEGER NOT NULL, "label" TEXT NOT NULL,
 "branch" TEXT NOT NULL, "nature" TEXT NOT NULL, "countMode" TEXT NOT NULL,
 "quantity" INTEGER NOT NULL, "endRoll" TEXT NOT NULL, "recess" BOOLEAN NOT NULL DEFAULT FALSE,
 "doubleEligible" BOOLEAN NOT NULL DEFAULT FALSE, "trigger" TEXT NOT NULL,
 "sourceUrl" TEXT NOT NULL, "caveat" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT TRUE,
 "approvedById" TEXT, "approvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeadlineRule_org_code_version_key" ON "DeadlineRule"("organizationId","code","version");
CREATE INDEX IF NOT EXISTS "DeadlineRule_org_branch_active_idx" ON "DeadlineRule"("organizationId","branch","active");

CREATE TABLE IF NOT EXISTS "CourtCalendarCoverage" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "tribunalCode" TEXT NOT NULL, "state" TEXT NOT NULL, "city" TEXT NOT NULL DEFAULT '',
 "year" INTEGER NOT NULL, "sourceUrl" TEXT NOT NULL, "evidence" TEXT NOT NULL,
 "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "verifiedById" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "CourtCalendarCoverage_scope_year_key" ON "CourtCalendarCoverage"("organizationId","tribunalCode","state","city","year");
CREATE INDEX IF NOT EXISTS "CourtCalendarCoverage_org_year_idx" ON "CourtCalendarCoverage"("organizationId","year");

CREATE TABLE IF NOT EXISTS "CourtSuspension" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "tribunalCode" TEXT NOT NULL, "state" TEXT NOT NULL, "city" TEXT NOT NULL DEFAULT '',
 "from" DATE NOT NULL, "to" DATE NOT NULL, "reason" TEXT NOT NULL, "evidence" TEXT NOT NULL,
 "approvedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CourtSuspension_valid_interval" CHECK("to" >= "from")
);
CREATE INDEX IF NOT EXISTS "CourtSuspension_org_dates_idx" ON "CourtSuspension"("organizationId","from","to");

CREATE TABLE IF NOT EXISTS "DeadlineCase" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "processId" TEXT REFERENCES "LegalProcess"("id") ON DELETE SET NULL,
 "createdById" TEXT NOT NULL,
 "ruleId" TEXT REFERENCES "DeadlineRule"("id") ON DELETE SET NULL,
 "ruleCode" TEXT NOT NULL, "ruleVersion" INTEGER NOT NULL, "ruleSnapshot" JSONB NOT NULL,
 "anchorDate" DATE NOT NULL, "anchorEvidence" TEXT NOT NULL,
 "tribunalCode" TEXT NOT NULL, "state" TEXT NOT NULL, "city" TEXT NOT NULL DEFAULT '',
 "fileFormat" TEXT NOT NULL, "doubleBasis" TEXT NOT NULL DEFAULT 'NONE', "doubleJustification" TEXT,
 "fixedDueAt" TIMESTAMP(3), "fixedDueAtRaw" TEXT, "internalBusinessDays" INTEGER NOT NULL DEFAULT 2,
 "legalDueOn" DATE NOT NULL, "internalDueOn" DATE NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW', "calendarVerified" BOOLEAN NOT NULL DEFAULT FALSE,
 "warnings" JSONB NOT NULL, "calculationHash" TEXT NOT NULL,
 "reviewerId" TEXT, "reviewedAt" TIMESTAMP(3), "reviewNotes" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DeadlineCase_internal_offset_range" CHECK("internalBusinessDays" BETWEEN 0 AND 20)
);
CREATE INDEX IF NOT EXISTS "DeadlineCase_org_due_status_idx" ON "DeadlineCase"("organizationId","legalDueOn","status");
CREATE INDEX IF NOT EXISTS "DeadlineCase_org_process_idx" ON "DeadlineCase"("organizationId","processId");

CREATE TABLE IF NOT EXISTS "DeadlineAlert" (
 "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "deadlineId" TEXT NOT NULL REFERENCES "DeadlineCase"("id") ON DELETE CASCADE,
 "kind" TEXT NOT NULL, "scheduledOn" DATE NOT NULL,
 "acknowledgedById" TEXT, "acknowledgedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeadlineAlert_case_kind_key" ON "DeadlineAlert"("deadlineId","kind");
CREATE INDEX IF NOT EXISTS "DeadlineAlert_org_day_ack_idx" ON "DeadlineAlert"("organizationId","scheduledOn","acknowledgedAt");
COMMIT;
