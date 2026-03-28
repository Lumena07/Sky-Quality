-- Audience targeting for compliance training types (departments, sub-roles).
ALTER TABLE "ComplianceTrainingType"
  ADD COLUMN IF NOT EXISTS "applicableDepartmentIds" JSONB DEFAULT NULL;

ALTER TABLE "ComplianceTrainingType"
  ADD COLUMN IF NOT EXISTS "applicableRoleMetadata" JSONB DEFAULT NULL;

COMMENT ON COLUMN "ComplianceTrainingType"."applicableDepartmentIds" IS 'Non-empty: user.departmentId must be in this string[]. Null/empty: no department filter.';
COMMENT ON COLUMN "ComplianceTrainingType"."applicableRoleMetadata" IS 'Partial criteria per role key (PILOT, FLIGHT_DISPATCHERS); see lib/training-compliance-applicability.ts.';
