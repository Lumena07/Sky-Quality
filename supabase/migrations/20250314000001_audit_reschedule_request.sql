-- Audit reschedule request: auditor requests new dates; Accountable Manager approves or rejects.
CREATE TABLE IF NOT EXISTS "AuditRescheduleRequest" (
  "id"                  TEXT PRIMARY KEY,
  "auditId"             TEXT NOT NULL,
  "requestedById"       TEXT NOT NULL,
  "requestedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "requestedStartDate"  DATE NOT NULL,
  "requestedEndDate"    DATE NOT NULL,
  "reason"              TEXT,
  "status"              TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  "reviewedById"        TEXT,
  "reviewedAt"          TIMESTAMPTZ,
  "reviewNotes"         TEXT,

  CONSTRAINT "AuditRescheduleRequest_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE,
  CONSTRAINT "AuditRescheduleRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "AuditRescheduleRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "AuditRescheduleRequest_auditId_idx"
  ON "AuditRescheduleRequest"("auditId");
CREATE INDEX IF NOT EXISTS "AuditRescheduleRequest_status_idx"
  ON "AuditRescheduleRequest"("status");
CREATE INDEX IF NOT EXISTS "AuditRescheduleRequest_requestedById_idx"
  ON "AuditRescheduleRequest"("requestedById");

COMMENT ON TABLE "AuditRescheduleRequest" IS 'Audit reschedule requests; only Accountable Manager can approve or reject. Audit cannot start while a request is PENDING.';
