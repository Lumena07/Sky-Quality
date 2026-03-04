-- ============================================
-- Migration: Support External Auditees
-- ============================================
-- This allows auditees to be added even if they don't exist in the User table
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Update AuditAuditee table to support external auditees
-- ============================================
DO $$ 
BEGIN
  -- Make userId nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'AuditAuditee' AND column_name = 'userId' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "AuditAuditee" ALTER COLUMN "userId" DROP NOT NULL;
  END IF;

  -- Add name column for external auditees
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'AuditAuditee' AND column_name = 'name'
  ) THEN
    ALTER TABLE "AuditAuditee" ADD COLUMN "name" TEXT;
  END IF;

  -- Add email column for external auditees
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'AuditAuditee' AND column_name = 'email'
  ) THEN
    ALTER TABLE "AuditAuditee" ADD COLUMN "email" TEXT;
  END IF;

  -- Update foreign key constraint to allow null
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'AuditAuditee_userId_fkey'
  ) THEN
    ALTER TABLE "AuditAuditee" DROP CONSTRAINT "AuditAuditee_userId_fkey";
  END IF;

  -- Recreate constraint with ON DELETE SET NULL
  ALTER TABLE "AuditAuditee" 
    ADD CONSTRAINT "AuditAuditee_userId_fkey" 
    FOREIGN KEY ("userId") 
    REFERENCES "User"("id") 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;
END $$;

-- ============================================
-- 2. Update unique constraint to handle null userId
-- ============================================
-- Drop existing unique constraint
DROP INDEX IF EXISTS "AuditAuditee_auditId_userId_key";

-- Create partial unique index that allows multiple null userIds per audit
-- (since external auditees can have null userId)
CREATE UNIQUE INDEX IF NOT EXISTS "AuditAuditee_auditId_userId_unique" 
ON "AuditAuditee"("auditId", "userId") 
WHERE "userId" IS NOT NULL;

-- Create unique index for external auditees (name + email combination per audit)
CREATE UNIQUE INDEX IF NOT EXISTS "AuditAuditee_auditId_name_email_unique" 
ON "AuditAuditee"("auditId", "name", "email") 
WHERE "userId" IS NULL AND "name" IS NOT NULL;

-- ============================================
-- Notes:
-- ============================================
-- 1. Now you can add auditees in two ways:
--    a) Internal users: Set userId (name and email will be from User table)
--    b) External auditees: Set name and email, leave userId as NULL
-- 
-- 2. Example for external auditee:
--    INSERT INTO "AuditAuditee" (id, "auditId", "userId", name, email, "createdAt")
--    VALUES ('auditee_ext_001', 'audit_id_here', NULL, 'External Person Name', 'external@example.com', CURRENT_TIMESTAMP);
--
-- 3. Example for internal user:
--    INSERT INTO "AuditAuditee" (id, "auditId", "userId", name, email, "createdAt")
--    VALUES ('auditee_int_001', 'audit_id_here', 'user_id_here', NULL, NULL, CURRENT_TIMESTAMP);
