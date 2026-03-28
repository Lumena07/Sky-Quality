-- App permission code stored on each catalog row (drives User.roles validation).
ALTER TABLE "DepartmentRoleCatalog" ADD COLUMN IF NOT EXISTS "roleCode" TEXT;

UPDATE "DepartmentRoleCatalog"
SET "roleCode" = TRIM(SPLIT_PART("description", ' —', 1))
WHERE COALESCE(TRIM("roleCode"), '') = ''
  AND "description" IS NOT NULL
  AND (
    "description" LIKE '% — default department mapping%'
    OR "description" LIKE '% — system role code%'
  );

UPDATE "DepartmentRoleCatalog"
SET "roleCode" = TRIM(SPLIT_PART("description", ' —', 1))
WHERE COALESCE(TRIM("roleCode"), '') = ''
  AND "description" IS NOT NULL
  AND POSITION(' —' IN "description") > 0;

CREATE INDEX IF NOT EXISTS "DepartmentRoleCatalog_roleCode_idx"
  ON "DepartmentRoleCatalog" ("roleCode");
