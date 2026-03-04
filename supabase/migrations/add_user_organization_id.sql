-- Link focal persons (external org contacts) to their organization.
-- Focal persons have role FOCAL_PERSON and organizationId set.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

COMMENT ON COLUMN "User"."organizationId" IS 'For FOCAL_PERSON users: the external organization they represent';

-- Optional: add FK if Organization table has id (uncomment if your Organization table exists)
-- ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey"
--   FOREIGN KEY ("organizationId") REFERENCES "Organization"("id");
