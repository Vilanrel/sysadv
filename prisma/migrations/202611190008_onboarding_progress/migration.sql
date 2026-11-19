CREATE TABLE "UserOnboardingProgress" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "completedSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserOnboardingProgress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserOnboardingProgress_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserOnboardingProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserOnboardingProgress_userId_key" ON "UserOnboardingProgress"("userId");
CREATE INDEX "UserOnboardingProgress_organizationId_updatedAt_idx" ON "UserOnboardingProgress"("organizationId","updatedAt");
