-- User roles as array: a user can have multiple roles (e.g. QUALITY_MANAGER and AUDITOR).
-- Rule: one cannot be both auditor and auditee on the same audit (enforced in app).

-- Add roles column (JSONB array of role strings)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "roles" JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "User"."roles" IS 'Array of role codes: SYSTEM_ADMIN, QUALITY_MANAGER, AUDITOR, DEPARTMENT_HEAD, STAFF';

-- Backfill from existing single role column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'role'
  ) THEN
    UPDATE "User"
    SET "roles" = jsonb_build_array("role")
    WHERE "role" IS NOT NULL AND (COALESCE("roles", '[]'::jsonb) = '[]'::jsonb OR "roles" IS NULL);
  END IF;
END $$;
