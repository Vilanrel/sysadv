-- Nova funcionalidade opt-in; aplicada somente apos baseline QA e revisao de backup.
CREATE TYPE "WorkflowEvent" AS ENUM ('INTAKE_CREATED','INTAKE_STATUS_CHANGED');
CREATE TYPE "WorkflowAction" AS ENUM ('CREATE_TASK');

CREATE TABLE "WorkflowRule" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "createdById" TEXT NOT NULL,
 "assignedToId" TEXT,
 "name" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
 "event" "WorkflowEvent" NOT NULL,
 "action" "WorkflowAction" NOT NULL DEFAULT 'CREATE_TASK',
 "taskTitle" TEXT NOT NULL,
 "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WorkflowRule_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "WorkflowRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "WorkflowRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "WorkflowRule_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "WorkflowRule_organizationId_event_enabled_idx" ON "WorkflowRule"("organizationId","event","enabled");

CREATE TABLE "WorkflowRun" (
 "id" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL,
 "ruleId" TEXT NOT NULL,
 "eventKey" TEXT NOT NULL,
 "taskId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "WorkflowRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "WorkflowRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WorkflowRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkflowRun_organizationId_ruleId_eventKey_key" ON "WorkflowRun"("organizationId","ruleId","eventKey");
CREATE INDEX "WorkflowRun_organizationId_createdAt_idx" ON "WorkflowRun"("organizationId","createdAt");
