-- ============================================
-- Checklist Tables for Supabase
-- ============================================
-- Copy and paste this SQL into Supabase SQL Editor
-- Make sure the User table exists before running this

-- ============================================
-- 1. Create Checklist Table
-- ============================================
CREATE TABLE IF NOT EXISTS "Checklist" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT,
  "checklistType" TEXT,
  "version" TEXT NOT NULL DEFAULT '1.0',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  
  CONSTRAINT "Checklist_createdById_fkey" 
    FOREIGN KEY ("createdById") 
    REFERENCES "User"("id") 
    ON DELETE RESTRICT 
    ON UPDATE CASCADE
);

-- ============================================
-- 2. Create ChecklistItem Table
-- ============================================
CREATE TABLE IF NOT EXISTS "ChecklistItem" (
  "id" TEXT PRIMARY KEY,
  "checklistId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "ref" TEXT,
  "auditQuestion" TEXT,
  "complianceCriteria" TEXT,
  "docRef" TEXT,
  "content" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ChecklistItem_checklistId_fkey" 
    FOREIGN KEY ("checklistId") 
    REFERENCES "Checklist"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
    
  CONSTRAINT "ChecklistItem_parentId_fkey" 
    FOREIGN KEY ("parentId") 
    REFERENCES "ChecklistItem"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
);

-- ============================================
-- 3. Create ChecklistRevision Table
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
-- 4. Add checklistId to Audit Table (if not exists)
-- ============================================
-- Check if column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Audit' AND column_name = 'checklistId'
  ) THEN
    ALTER TABLE "Audit" ADD COLUMN "checklistId" TEXT;
    
    ALTER TABLE "Audit" 
      ADD CONSTRAINT "Audit_checklistId_fkey" 
      FOREIGN KEY ("checklistId") 
      REFERENCES "Checklist"("id") 
      ON DELETE SET NULL 
      ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================
-- 5. Create Indexes for Checklist Table
-- ============================================
CREATE INDEX IF NOT EXISTS "Checklist_type_idx" ON "Checklist"("type");
CREATE INDEX IF NOT EXISTS "Checklist_checklistType_idx" ON "Checklist"("checklistType");
CREATE INDEX IF NOT EXISTS "Checklist_isActive_idx" ON "Checklist"("isActive");
CREATE INDEX IF NOT EXISTS "Checklist_createdById_idx" ON "Checklist"("createdById");
CREATE INDEX IF NOT EXISTS "Checklist_version_idx" ON "Checklist"("version");

-- ============================================
-- 6. Create Indexes for ChecklistRevision Table
-- ============================================
CREATE INDEX IF NOT EXISTS "ChecklistRevision_checklistId_idx" ON "ChecklistRevision"("checklistId");
CREATE INDEX IF NOT EXISTS "ChecklistRevision_version_idx" ON "ChecklistRevision"("version");
CREATE INDEX IF NOT EXISTS "ChecklistRevision_createdAt_idx" ON "ChecklistRevision"("createdAt");

-- ============================================
-- 7. Create Indexes for ChecklistItem Table
-- ============================================
CREATE INDEX IF NOT EXISTS "ChecklistItem_checklistId_idx" ON "ChecklistItem"("checklistId");
CREATE INDEX IF NOT EXISTS "ChecklistItem_parentId_idx" ON "ChecklistItem"("parentId");
CREATE INDEX IF NOT EXISTS "ChecklistItem_order_idx" ON "ChecklistItem"("order");

-- ============================================
-- 8. Create Index for Audit checklistId (if column was added)
-- ============================================
CREATE INDEX IF NOT EXISTS "Audit_checklistId_idx" ON "Audit"("checklistId");

-- ============================================
-- 9. Create Function to Update updatedAt Timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. Create Triggers for updatedAt
-- ============================================
DROP TRIGGER IF EXISTS update_checklist_updated_at ON "Checklist";
CREATE TRIGGER update_checklist_updated_at
  BEFORE UPDATE ON "Checklist"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checklist_item_updated_at ON "ChecklistItem";
CREATE TRIGGER update_checklist_item_updated_at
  BEFORE UPDATE ON "ChecklistItem"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Notes:
-- ============================================
-- 1. The "id" fields use TEXT type to match Prisma's cuid() format
-- 2. Make sure your User table exists before running this script
-- 3. If you're using UUID instead of cuid, change TEXT to UUID
-- 4. The checklistId column in Audit will only be added if it doesn't exist
-- 5. All foreign keys are set up with appropriate CASCADE/SET NULL behavior
-- 6. Indexes are created for optimal query performance
-- 7. Triggers automatically update the updatedAt timestamp on row updates
-- 8. Version control is included: Checklists start at version "1.0" and revisions are tracked