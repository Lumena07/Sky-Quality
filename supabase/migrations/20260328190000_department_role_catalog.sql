-- QM: organizational role titles per department (catalog only; not app permissions)
CREATE TABLE IF NOT EXISTS "DepartmentRoleCatalog" (
  "id"                 TEXT PRIMARY KEY,
  "departmentId"       TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "description"        TEXT,
  "sortOrder"          INTEGER NOT NULL DEFAULT 0,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "DepartmentRoleCatalog_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentRoleCatalog_dept_name_lower_idx"
  ON "DepartmentRoleCatalog" ("departmentId", (LOWER(TRIM("name"))));

CREATE INDEX IF NOT EXISTS "DepartmentRoleCatalog_departmentId_idx"
  ON "DepartmentRoleCatalog" ("departmentId");

CREATE INDEX IF NOT EXISTS "DepartmentRoleCatalog_isActive_idx"
  ON "DepartmentRoleCatalog" ("isActive");
