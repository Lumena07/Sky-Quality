-- FindingEscalation: record when a finding was escalated to the Accountable Manager (per ICAO / Auric Air Manual).
CREATE TABLE IF NOT EXISTS "FindingEscalation" (
  "id"           TEXT PRIMARY KEY,
  "findingId"    TEXT NOT NULL,
  "escalatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "escalatedToUserId" TEXT NOT NULL,
  "trigger"      TEXT NOT NULL DEFAULT 'OVERDUE_CAP',

  CONSTRAINT "FindingEscalation_findingId_fkey"
    FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE,
  CONSTRAINT "FindingEscalation_escalatedToUserId_fkey"
    FOREIGN KEY ("escalatedToUserId") REFERENCES "User"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FindingEscalation_findingId_key"
  ON "FindingEscalation"("findingId");
CREATE INDEX IF NOT EXISTS "FindingEscalation_escalatedToUserId_idx"
  ON "FindingEscalation"("escalatedToUserId");
CREATE INDEX IF NOT EXISTS "FindingEscalation_escalatedAt_idx"
  ON "FindingEscalation"("escalatedAt");

COMMENT ON TABLE "FindingEscalation" IS 'Tracks findings escalated to Accountable Manager; one row per finding (no duplicate escalations).';
