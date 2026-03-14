-- Documented/Implemented status for each checklist item response (4 options).
ALTER TABLE "AuditChecklistItemResponse"
  ADD COLUMN IF NOT EXISTS "documentedImplementedStatus" TEXT NULL;

ALTER TABLE "AuditChecklistItemResponse"
  DROP CONSTRAINT IF EXISTS "AuditChecklistItemResponse_documentedImplementedStatus_check";

ALTER TABLE "AuditChecklistItemResponse"
  ADD CONSTRAINT "AuditChecklistItemResponse_documentedImplementedStatus_check"
  CHECK (
    "documentedImplementedStatus" IS NULL
    OR "documentedImplementedStatus" IN (
      'DOCUMENTED_IMPLEMENTED',
      'DOCUMENTED_NOT_IMPLEMENTED',
      'NOT_DOCUMENTED_IMPLEMENTED',
      'NOT_DOCUMENTED_NOT_IMPLEMENTED'
    )
  );

COMMENT ON COLUMN "AuditChecklistItemResponse"."documentedImplementedStatus" IS 'Documented and/or implemented status: DOCUMENTED_IMPLEMENTED, DOCUMENTED_NOT_IMPLEMENTED, NOT_DOCUMENTED_IMPLEMENTED, NOT_DOCUMENTED_NOT_IMPLEMENTED.';
