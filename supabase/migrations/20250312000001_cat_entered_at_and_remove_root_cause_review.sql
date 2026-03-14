-- Add catEnteredAt to CorrectiveAction (when CAT was entered)
ALTER TABLE "CorrectiveAction" ADD COLUMN IF NOT EXISTS "catEnteredAt" TIMESTAMP(3);

-- Remove root-cause review fields from Finding
ALTER TABLE "Finding" DROP COLUMN IF EXISTS "rootCauseStatus";
ALTER TABLE "Finding" DROP COLUMN IF EXISTS "rootCauseReviewedById";
ALTER TABLE "Finding" DROP COLUMN IF EXISTS "rootCauseReviewedAt";
ALTER TABLE "Finding" DROP COLUMN IF EXISTS "rootCauseRejectionReason";
