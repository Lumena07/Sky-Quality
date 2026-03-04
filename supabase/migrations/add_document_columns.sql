-- Add issue number, revision number, and manual holders to Document table (camelCase).
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "issueNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "revisionNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "manualHolderIds" JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "Document"."issueNumber" IS 'Document issue number (required for new uploads)';
COMMENT ON COLUMN "Document"."revisionNumber" IS 'Document revision number (required for new uploads)';
COMMENT ON COLUMN "Document"."manualHolderIds" IS 'Array of user IDs who are manual holders';
