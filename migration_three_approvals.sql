-- Three separate approvals: Root Cause, Corrective Action Plan (CAP), Corrective Action Taken (CAT)
-- Status: PENDING | APPROVED | REJECTED. When REJECTED, rejection reason is stored and sent back to responsible person.

-- 1. Finding: Root Cause approval
ALTER TABLE "Finding"
  ADD COLUMN IF NOT EXISTS "rootCauseStatus" TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "rootCauseReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "rootCauseReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rootCauseRejectionReason" TEXT;

-- 2. CorrectiveAction: CAP approval (separate from existing managementApproval)
ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "capStatus" TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "capReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "capReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "capRejectionReason" TEXT;

-- 3. CorrectiveAction: CAT approval (correctiveActionTaken is already there)
ALTER TABLE "CorrectiveAction"
  ADD COLUMN IF NOT EXISTS "catStatus" TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "catReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "catReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "catRejectionReason" TEXT;

-- Optional: FK for reviewedBy columns (reference User id)
-- ALTER TABLE "Finding" ADD CONSTRAINT "Finding_rootCauseReviewedById_fkey" FOREIGN KEY ("rootCauseReviewedById") REFERENCES "User"("id");
-- ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_capReviewedById_fkey" FOREIGN KEY ("capReviewedById") REFERENCES "User"("id");
-- ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_catReviewedById_fkey" FOREIGN KEY ("catReviewedById") REFERENCES "User"("id");
