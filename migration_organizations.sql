-- ============================================
-- Organizations: for External (auditees) and 3rd Party (auditors)
-- ============================================
-- Run in Supabase SQL Editor.
-- External audit: select organizations as auditees (we audit them).
-- 3rd party audit: select organizations as auditors (they audit us).

-- ============================================
-- 1. Create Organization table
-- ============================================
CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "type" TEXT,
  "contact" TEXT,
  "address" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. AuditAuditee: add organizationId (external audit = org as auditee)
-- ============================================
ALTER TABLE "AuditAuditee"
ADD COLUMN IF NOT EXISTS "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 3. AuditAuditor: add organizationId, make userId nullable (3rd party = org as auditor)
-- ============================================
ALTER TABLE "AuditAuditor"
ADD COLUMN IF NOT EXISTS "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AuditAuditor' AND column_name = 'userId' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "AuditAuditor" ALTER COLUMN "userId" DROP NOT NULL;
  END IF;
END $$;

-- ============================================
-- 4. Unique constraints: one org per audit (auditee/auditor)
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS "AuditAuditee_auditId_organizationId_unique"
ON "AuditAuditee"("auditId", "organizationId") WHERE "organizationId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AuditAuditor_auditId_organizationId_unique"
ON "AuditAuditor"("auditId", "organizationId") WHERE "organizationId" IS NOT NULL;

-- ============================================
-- 5. Grants (if using authenticated role)
-- ============================================
GRANT SELECT, INSERT, UPDATE, DELETE ON "Organization" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Organization" TO service_role;
