-- QMS: AM CAP signature, auditor CAT follow-up, TCAA mandatory notifications

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "amCapSignatureUrl" TEXT NULL;

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "catAuditorFollowUp" TEXT NULL;

CREATE TABLE IF NOT EXISTS "TcaaMandatoryNotification" (
  "id"           TEXT PRIMARY KEY,
  "findingId"    TEXT NOT NULL,
  "source"       TEXT NOT NULL,
  "notes"        TEXT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"  TEXT NOT NULL,
  "resolvedAt"   TIMESTAMPTZ NULL,
  CONSTRAINT "TcaaMandatoryNotification_findingId_fkey"
    FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE,
  CONSTRAINT "TcaaMandatoryNotification_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "TcaaMandatoryNotification_createdAt_idx"
  ON "TcaaMandatoryNotification"("createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "TcaaMandatoryNotification_finding_auto_key"
  ON "TcaaMandatoryNotification"("findingId")
  WHERE "source" = 'AUTO_P1_NOT_CLOSED_ON_TIME';

COMMENT ON TABLE "TcaaMandatoryNotification" IS 'TCAA mandatory notification register; QM manual entries and auto P1 close-out overdue.';
