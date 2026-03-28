-- Optional proof document (certificate/form) per compliance training completion row
ALTER TABLE "ComplianceTrainingCompletion"
  ADD COLUMN IF NOT EXISTS "completionProofUrl" TEXT;
