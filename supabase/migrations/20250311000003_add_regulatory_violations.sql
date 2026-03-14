-- RegulatoryViolation: zero-tolerance tracking for regulatory compliance KPI.
CREATE TABLE IF NOT EXISTS "RegulatoryViolation" (
  "id"              TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "severity"        TEXT,
  "occurredAt"      TIMESTAMPTZ NOT NULL,
  "auditId"         TEXT,
  "findingId"       TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "RegulatoryViolation_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL,
  CONSTRAINT "RegulatoryViolation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE SET NULL,
  CONSTRAINT "RegulatoryViolation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RegulatoryViolation_occurredAt_idx" ON "RegulatoryViolation"("occurredAt");
CREATE INDEX IF NOT EXISTS "RegulatoryViolation_auditId_idx" ON "RegulatoryViolation"("auditId");

COMMENT ON TABLE "RegulatoryViolation" IS 'Regulatory violations for zero-tolerance KPI (target 0).';
