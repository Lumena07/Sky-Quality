-- ============================================
-- Add internal focal person for external audits
-- ============================================
-- For EXTERNAL audits (we audit outside parties), findings are assigned to
-- an internal focal person. Run in Supabase SQL Editor.

ALTER TABLE "Audit"
ADD COLUMN IF NOT EXISTS "focalPersonId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON COLUMN "Audit"."focalPersonId" IS 'Internal focal person for external audits; findings default to this user.';
