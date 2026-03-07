-- Auditee extension request for Root cause / CAP / CAT due dates
CREATE TABLE IF NOT EXISTS "FindingExtensionRequest" (
  "id"                      TEXT PRIMARY KEY,
  "findingId"               TEXT NOT NULL,
  "requestedById"           TEXT NOT NULL,
  "requestedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reason"                  TEXT NOT NULL,
  "requestedCapDueDate"     DATE,
  "requestedCloseOutDueDate" DATE,
  "status"                  TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  "reviewedById"            TEXT,
  "reviewedAt"              TIMESTAMPTZ,
  "reviewNotes"             TEXT,

  CONSTRAINT "FindingExtensionRequest_findingId_fkey"
    FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE,
  CONSTRAINT "FindingExtensionRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "FindingExtensionRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "FindingExtensionRequest_findingId_idx"
  ON "FindingExtensionRequest"("findingId");
CREATE INDEX IF NOT EXISTS "FindingExtensionRequest_requestedById_idx"
  ON "FindingExtensionRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "FindingExtensionRequest_status_idx"
  ON "FindingExtensionRequest"("status");

COMMENT ON TABLE "FindingExtensionRequest" IS 'Auditee requests to extend Root cause / CAP / CAT due dates; reviewer approves or rejects.';
