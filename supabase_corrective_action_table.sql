-- Recreate CorrectiveAction table: drop existing then create with full schema.
-- All fields are explicitly CAP (Corrective Action Plan) or CAT (Corrective Action Taken).
-- Run in Supabase SQL editor. CASCADE drops dependent foreign-key constraints.

DROP TABLE IF EXISTS "CorrectiveAction" CASCADE;

CREATE TABLE "CorrectiveAction" (
  "id"                TEXT PRIMARY KEY,
  "findingId"          TEXT NOT NULL UNIQUE,
  "responsibleId"      TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  -- CAP (Corrective Action Plan) specific
  "actionPlan"        TEXT NOT NULL,
  "dueDate"           TIMESTAMP(3) NOT NULL,
  "capEnteredAt"      TIMESTAMP(3),
  "capStatus"         TEXT DEFAULT 'PENDING',
  "capReviewedById"   TEXT,
  "capReviewedAt"    TIMESTAMP(3),
  "capRejectionReason" TEXT,

  -- CAT (Corrective Action Taken) specific
  "correctiveActionTaken" TEXT,
  "catDueDate"        TIMESTAMP(3),
  "completionDate"    TIMESTAMP(3),
  "evidenceUrl"       TEXT,
  "catStatus"         TEXT DEFAULT 'PENDING',
  "catReviewedById"   TEXT,
  "catReviewedAt"    TIMESTAMP(3),
  "catRejectionReason" TEXT,

  -- Overall record workflow (OPEN, IN_PROGRESS, CLOSED)
  "status"            TEXT NOT NULL DEFAULT 'IN_PROGRESS',

  CONSTRAINT "CorrectiveAction_findingId_fkey"
    FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE,
  CONSTRAINT "CorrectiveAction_responsibleId_fkey"
    FOREIGN KEY ("responsibleId") REFERENCES "User"("id")
);

CREATE INDEX "CorrectiveAction_findingId_idx" ON "CorrectiveAction"("findingId");
CREATE INDEX "CorrectiveAction_responsibleId_idx" ON "CorrectiveAction"("responsibleId");
CREATE INDEX "CorrectiveAction_dueDate_idx" ON "CorrectiveAction"("dueDate");
CREATE INDEX "CorrectiveAction_status_idx" ON "CorrectiveAction"("status");

-- Re-add foreign keys from tables that reference CorrectiveAction (CASCADE removed them).
-- Comment out the next two lines if you do not have CAPAttachment or ActivityLog.
ALTER TABLE "CAPAttachment" ADD CONSTRAINT "CAPAttachment_correctiveActionId_fkey"
  FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id") ON DELETE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_correctiveActionId_fkey"
  FOREIGN KEY ("correctiveActionId") REFERENCES "CorrectiveAction"("id");
