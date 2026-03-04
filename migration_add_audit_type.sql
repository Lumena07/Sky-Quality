-- Migration: Add AuditType enum and type field to Audit model
-- Run this SQL directly in Supabase SQL Editor to bypass connection pool limits

-- Step 1: Create the AuditType enum
DO $$ BEGIN
    CREATE TYPE "AuditType" AS ENUM ('INTERNAL', 'EXTERNAL', 'THIRD_PARTY', 'ERP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add the type column to Audit table (with default value)
ALTER TABLE "Audit" 
ADD COLUMN IF NOT EXISTS "type" "AuditType" NOT NULL DEFAULT 'INTERNAL';

-- Step 3: Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'Audit' AND column_name = 'type';
