-- AuditPlan: recurring audit schedule definition (name, interval, last done).
CREATE TABLE IF NOT EXISTS "AuditPlan" (
  "id"              TEXT PRIMARY KEY,
  "name"            TEXT NOT NULL,
  "intervalMonths"  INTEGER NOT NULL CHECK ("intervalMonths" > 0),
  "lastDoneDate"    DATE,
  "departmentId"    TEXT,
  "base"            TEXT,
  "scope"           TEXT,
  "createdById"     TEXT NOT NULL,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AuditPlan_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL,
  CONSTRAINT "AuditPlan_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditPlan_createdById_idx" ON "AuditPlan"("createdById");
CREATE INDEX IF NOT EXISTS "AuditPlan_departmentId_idx" ON "AuditPlan"("departmentId");

COMMENT ON TABLE "AuditPlan" IS 'Recurring audit schedule: name, interval in months, last done date. Next due = lastDoneDate + intervalMonths.';

-- Link Audit to AuditPlan when created from tracker; update plan lastDoneDate when audit completes.
ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "auditPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "upcomingNotificationSentAt" TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Audit_auditPlanId_fkey'
  ) THEN
    ALTER TABLE "Audit"
      ADD CONSTRAINT "Audit_auditPlanId_fkey"
      FOREIGN KEY ("auditPlanId") REFERENCES "AuditPlan"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Audit_auditPlanId_idx" ON "Audit"("auditPlanId");

COMMENT ON COLUMN "Audit"."auditPlanId" IS 'Set when audit was created from Audit Plan tracker; used to update plan lastDoneDate on completion.';
COMMENT ON COLUMN "Audit"."upcomingNotificationSentAt" IS 'Set when 7-day upcoming notifications have been sent for this audit.';
