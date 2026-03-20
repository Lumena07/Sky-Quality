-- Audit preparation: reviewer step timestamps and supplemental questions per audit.

ALTER TABLE "Audit" ADD COLUMN IF NOT EXISTS "preparationPriorFindingsReviewedAt" TIMESTAMPTZ NULL;
ALTER TABLE "Audit" ADD COLUMN IF NOT EXISTS "preparationPriorFindingsReviewedById" TEXT NULL;
ALTER TABLE "Audit" ADD COLUMN IF NOT EXISTS "preparationStandardsReviewedAt" TIMESTAMPTZ NULL;
ALTER TABLE "Audit" ADD COLUMN IF NOT EXISTS "preparationStandardsReviewedById" TEXT NULL;

ALTER TABLE "Audit"
  DROP CONSTRAINT IF EXISTS "Audit_preparationPriorFindingsReviewedById_fkey",
  DROP CONSTRAINT IF EXISTS "Audit_preparationStandardsReviewedById_fkey";

ALTER TABLE "Audit"
  ADD CONSTRAINT "Audit_preparationPriorFindingsReviewedById_fkey"
    FOREIGN KEY ("preparationPriorFindingsReviewedById") REFERENCES "User"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "Audit_preparationStandardsReviewedById_fkey"
    FOREIGN KEY ("preparationStandardsReviewedById") REFERENCES "User"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Audit_preparationPriorFindingsReviewedById_idx"
  ON "Audit"("preparationPriorFindingsReviewedById");
CREATE INDEX IF NOT EXISTS "Audit_preparationStandardsReviewedById_idx"
  ON "Audit"("preparationStandardsReviewedById");

CREATE TABLE IF NOT EXISTS "AuditPreparationQuestion" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "auditId"       TEXT NOT NULL,
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "questionText"  TEXT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdById"   TEXT NOT NULL,

  CONSTRAINT "AuditPreparationQuestion_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE,
  CONSTRAINT "AuditPreparationQuestion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditPreparationQuestion_auditId_idx"
  ON "AuditPreparationQuestion"("auditId");
CREATE INDEX IF NOT EXISTS "AuditPreparationQuestion_auditId_sortOrder_idx"
  ON "AuditPreparationQuestion"("auditId", "sortOrder");

COMMENT ON TABLE "AuditPreparationQuestion" IS 'Supplemental per-audit questions for audit preparation (in addition to checklist template).';
