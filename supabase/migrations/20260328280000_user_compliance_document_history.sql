CREATE TABLE IF NOT EXISTS "UserComplianceDocumentHistory" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "documentKind" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById" TEXT,
  "expiryDate" DATE,
  "pdfFileUrl" TEXT,
  CONSTRAINT "UserComplianceDocumentHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserComplianceDocumentHistory_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "UserComplianceDocumentHistory_user_kind_created_idx"
  ON "UserComplianceDocumentHistory" ("userId", "documentKind", "createdAt" DESC);
