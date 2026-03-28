-- QMS: scheduled date and location for auditor programme assignments
ALTER TABLE "AuditorTrainingAssignment"
  ADD COLUMN IF NOT EXISTS "scheduledDate" DATE,
  ADD COLUMN IF NOT EXISTS "location" TEXT;
