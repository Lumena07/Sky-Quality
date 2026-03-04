-- ============================================
-- Checklist Versioning Migration for Supabase
-- ============================================
-- Copy and paste this SQL into Supabase SQL Editor
-- This adds version control to existing Checklist tables
-- Run this AFTER the initial supabase_checklist_schema.sql

-- ============================================
-- 1. Add version column to Checklist table
-- ============================================
DO $$ 
BEGIN
  -- Check if version column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Checklist' AND column_name = 'version'
  ) THEN
    -- Add version column with default value
    ALTER TABLE "Checklist" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
    
    -- Update existing records to have version 1.0 if they're null (shouldn't happen with NOT NULL, but just in case)
    UPDATE "Checklist" SET "version" = '1.0' WHERE "version" IS NULL;
  END IF;
END $$;

-- ============================================
-- 2. Create ChecklistRevision Table
-- ============================================
CREATE TABLE IF NOT EXISTS "ChecklistRevision" (
  "id" TEXT PRIMARY KEY,
  "checklistId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "changeLog" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ChecklistRevision_checklistId_fkey" 
    FOREIGN KEY ("checklistId") 
    REFERENCES "Checklist"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  CONSTRAINT "ChecklistRevision_createdById_fkey" 
    FOREIGN KEY ("createdById") 
    REFERENCES "User"("id") 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE
);

-- ============================================
-- 3. Create Indexes for ChecklistRevision Table
-- ============================================
CREATE INDEX IF NOT EXISTS "ChecklistRevision_checklistId_idx" ON "ChecklistRevision"("checklistId");
CREATE INDEX IF NOT EXISTS "ChecklistRevision_version_idx" ON "ChecklistRevision"("version");
CREATE INDEX IF NOT EXISTS "ChecklistRevision_createdAt_idx" ON "ChecklistRevision"("createdAt");

-- ============================================
-- 4. Create Index for Checklist version column
-- ============================================
CREATE INDEX IF NOT EXISTS "Checklist_version_idx" ON "Checklist"("version");

-- ============================================
-- 5. Create Initial Revision Records for Existing Checklists
-- ============================================
-- This creates revision records for existing checklists that don't have any revisions yet
-- Note: This assumes you have a way to generate IDs (cuid format). 
-- If using UUID, change the id generation accordingly.
DO $$
DECLARE
  checklist_record RECORD;
  revision_id TEXT;
BEGIN
  -- Loop through all checklists that don't have any revisions
  FOR checklist_record IN 
    SELECT c."id", c."version", c."createdById", c."createdAt"
    FROM "Checklist" c
    WHERE NOT EXISTS (
      SELECT 1 FROM "ChecklistRevision" cr 
      WHERE cr."checklistId" = c."id"
    )
  LOOP
    -- Generate a unique ID (using a simple approach - adjust if you need cuid format)
    -- For Supabase, you might want to use gen_random_uuid() if using UUIDs
    -- Or use a function that generates cuid-like IDs
    revision_id := 'rev_' || checklist_record."id" || '_' || EXTRACT(EPOCH FROM NOW())::TEXT;
    
    -- Create initial revision record
    INSERT INTO "ChecklistRevision" (
      "id",
      "checklistId",
      "version",
      "changeLog",
      "createdById",
      "createdAt"
    ) VALUES (
      revision_id,
      checklist_record."id",
      COALESCE(checklist_record."version", '1.0'),
      'Initial version (migrated)',
      checklist_record."createdById",
      checklist_record."createdAt"
    );
  END LOOP;
END $$;

-- ============================================
-- Notes:
-- ============================================
-- 1. This migration is safe to run multiple times (uses IF NOT EXISTS checks)
-- 2. Existing checklists will get version "1.0" if they don't have one
-- 3. Initial revision records are created for existing checklists
-- 4. The revision ID generation uses a simple approach - adjust if you need cuid() format
-- 5. If you're using UUIDs instead of cuid, change the revision_id generation to use gen_random_uuid()
-- 6. All foreign keys are set up with appropriate CASCADE/RESTRICT behavior
-- 7. Indexes are created for optimal query performance
