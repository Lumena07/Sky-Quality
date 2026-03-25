-- Quality module: CAP resource types + AM gate, Organization department seed, external audit documentation metadata.

-- 1) Department audit area: Organization (same pattern as other departments)
INSERT INTO "Department" ("id", "name", "code", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'Organization', 'ORG', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Department" WHERE "code" = 'ORG' OR LOWER("name") = 'organization');

-- 2) CorrectiveAction: resources + Accountable Manager CAP approval
ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "capResourceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "amCapStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "amCapReviewedById" TEXT NULL;

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "amCapReviewedAt" TIMESTAMPTZ NULL;

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "amCapRejectionReason" TEXT NULL;

-- 2b) Upfront longer CAT due-date proposal at CAP entry (separate from extension requests)
ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "proposedCatDueDate" TIMESTAMPTZ NULL;

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "proposedCatDueDateReason" TEXT NULL;

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "catDueDateProposalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "catDueDateReviewedById" TEXT NULL;

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "catDueDateReviewedAt" TIMESTAMPTZ NULL;

ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "catDueDateRejectionReason" TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CorrectiveAction_amCapStatus_check'
  ) THEN
    ALTER TABLE "CorrectiveAction"
      ADD CONSTRAINT "CorrectiveAction_amCapStatus_check"
      CHECK ("amCapStatus" IN ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CorrectiveAction_catDueDateProposalStatus_check'
  ) THEN
    ALTER TABLE "CorrectiveAction"
      ADD CONSTRAINT "CorrectiveAction_catDueDateProposalStatus_check"
      CHECK ("catDueDateProposalStatus" IN ('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED'));
  END IF;
END $$;

-- 3) Audit: optional timestamp when checklist/schedule + documentation request was sent
ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "documentationRequestedAt" TIMESTAMPTZ NULL;

-- 4) AuditDocument: classify focal pre-audit submissions for retention/purge
ALTER TABLE "AuditDocument"
  ADD COLUMN IF NOT EXISTS "documentKind" TEXT NOT NULL DEFAULT 'GENERAL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditDocument_documentKind_check'
  ) THEN
    ALTER TABLE "AuditDocument"
      ADD CONSTRAINT "AuditDocument_documentKind_check"
      CHECK ("documentKind" IN ('GENERAL', 'FOCAL_PRE_AUDIT'));
  END IF;
END $$;
