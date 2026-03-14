-- Set when checklist and schedule were sent to auditees; required before starting non-ERP audit.
ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "checklistScheduleSentAt" TIMESTAMPTZ NULL;

COMMENT ON COLUMN "Audit"."checklistScheduleSentAt" IS 'Set when checklist and schedule were sent to auditees; required before starting non-ERP audit.';
