-- ============================================
-- ERP: departmentId optional on Audit
-- ============================================
-- Run in Supabase SQL Editor. ERP audits have no department.

ALTER TABLE "Audit"
ALTER COLUMN "departmentId" DROP NOT NULL;
