-- Finding table (matches Prisma model in prisma/schema.prisma).
-- Run in Supabase SQL editor.
--
-- If "Finding" already has data: do NOT drop the table. Use migration_finding_add_columns.sql
-- to add any missing columns instead (no data loss).

-- Optional: drop existing (ONLY if table is empty or you intend to lose all data; CASCADE drops dependent FKs).
-- DROP TABLE IF EXISTS "Finding" CASCADE;

CREATE TABLE IF NOT EXISTS "Finding" (
  "id"                        TEXT PRIMARY KEY,
  "findingNumber"              TEXT NOT NULL UNIQUE,
  "auditId"                   TEXT NOT NULL,
  "departmentId"               TEXT NOT NULL,
  "policyReference"           TEXT NOT NULL,
  "description"                TEXT NOT NULL,
  "rootCause"                 TEXT,
  "severity"                  TEXT NOT NULL,
  "priority"                  TEXT,
  "checklistItemId"           TEXT,
  "status"                    TEXT NOT NULL DEFAULT 'OPEN',
  "assignedToId"              TEXT NOT NULL,
  "dueDate"                   TIMESTAMP(3),
  "capDueDate"                TIMESTAMP(3),
  "closeOutDueDate"           TIMESTAMP(3),
  "closedDate"                TIMESTAMP(3),
  "closedBy"                  TEXT,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL,
  "createdById"               TEXT NOT NULL,

  CONSTRAINT "Finding_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id"),
  CONSTRAINT "Finding_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id"),
  CONSTRAINT "Finding_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id"),
  CONSTRAINT "Finding_checklistItemId_fkey"
    FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id"),
  CONSTRAINT "Finding_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Finding_findingNumber_key" ON "Finding"("findingNumber");
CREATE INDEX IF NOT EXISTS "Finding_auditId_idx" ON "Finding"("auditId");
CREATE INDEX IF NOT EXISTS "Finding_departmentId_idx" ON "Finding"("departmentId");
CREATE INDEX IF NOT EXISTS "Finding_assignedToId_idx" ON "Finding"("assignedToId");
CREATE INDEX IF NOT EXISTS "Finding_status_idx" ON "Finding"("status");
CREATE INDEX IF NOT EXISTS "Finding_dueDate_idx" ON "Finding"("dueDate");
CREATE INDEX IF NOT EXISTS "Finding_findingNumber_idx" ON "Finding"("findingNumber");
CREATE INDEX IF NOT EXISTS "Finding_priority_idx" ON "Finding"("priority");
CREATE INDEX IF NOT EXISTS "Finding_checklistItemId_idx" ON "Finding"("checklistItemId");
