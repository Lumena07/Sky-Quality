-- Add departmentIds (multiple departments) and remove single departmentId from Document table (camelCase).
-- Run this in Supabase SQL Editor.

-- Add new column for multiple departments
ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "departmentIds" JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "Document"."departmentIds" IS 'Array of department IDs to notify for this approved manual';

-- Remove old single department column (no data to preserve)
ALTER TABLE "Document"
  DROP COLUMN IF EXISTS "departmentId";
