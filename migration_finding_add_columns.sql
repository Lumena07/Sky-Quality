-- Add missing columns to existing "Finding" table WITHOUT dropping the table.
-- Safe to run when there is already data: only adds columns that don't exist.
-- Run this in Supabase SQL editor.

-- Root cause approval columns
ALTER TABLE "Finding"
  ADD COLUMN IF NOT EXISTS "rootCauseStatus" TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "rootCauseReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "rootCauseReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rootCauseRejectionReason" TEXT;

-- If your table was created without these, uncomment and run (one at a time if ADD COLUMN IF NOT EXISTS not supported):
-- ALTER TABLE "Finding" ADD COLUMN IF NOT EXISTS "capDueDate" TIMESTAMP(3);
-- ALTER TABLE "Finding" ADD COLUMN IF NOT EXISTS "closeOutDueDate" TIMESTAMP(3);
