CREATE TABLE IF NOT EXISTS "ComplianceTrainingCompletionHistory" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "trainingTypeId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById" TEXT,
  "lastCompletedAt" TIMESTAMPTZ,
  "nextDueAt" TIMESTAMPTZ,
  "completionProofUrl" TEXT,
  CONSTRAINT "ComplianceTrainingCompletionHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "ComplianceTrainingCompletionHistory_trainingTypeId_fkey"
    FOREIGN KEY ("trainingTypeId") REFERENCES "ComplianceTrainingType"("id") ON DELETE CASCADE,
  CONSTRAINT "ComplianceTrainingCompletionHistory_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "ComplianceTrainingCompletionHistory_user_type_created_idx"
  ON "ComplianceTrainingCompletionHistory" ("userId", "trainingTypeId", "createdAt" DESC);
