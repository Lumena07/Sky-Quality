-- Seed DepartmentRoleCatalog: exactly one row per catalog role, each tied to its owning department
-- (QM/Auditor → Quality, AM/Staff/Dept head → Organization, Safety roles → Safety, flight roles → Operations).

DELETE FROM "DepartmentRoleCatalog"
WHERE "description" LIKE '% — default department mapping (catalog reference only; permissions are set on the user).%'
   OR "description" LIKE '% — system role code (reference only; user permissions are set on the user account).%';

INSERT INTO "DepartmentRoleCatalog" (
  "id",
  "departmentId",
  "name",
  "description",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  dept.id,
  v.role_name,
  v.role_code || ' — default department mapping (catalog reference only; permissions are set on the user).',
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('QUALITY_MANAGER'::text,      'Quality Manager'::text,      'QUALITY'::text),
    ('ACCOUNTABLE_MANAGER'::text,  'Accountable Manager'::text,  'ORG'::text),
    ('AUDITOR'::text,              'Auditor'::text,              'QUALITY'::text),
    ('STAFF'::text,                'Office staff'::text,         'ORG'::text),
    ('DIRECTOR_OF_SAFETY'::text,   'Director of Safety'::text,   'SAFETY'::text),
    ('SAFETY_OFFICER'::text,       'Safety Officer'::text,       'SAFETY'::text),
    ('DEPARTMENT_HEAD'::text,      'Department Head'::text,      'ORG'::text),
    ('PILOT'::text,                'Pilot'::text,                'OPS'::text),
    ('CABIN_CREW'::text,           'Cabin Crew'::text,           'OPS'::text),
    ('FLIGHT_DISPATCHERS'::text,   'Flight Dispatchers'::text,   'OPS'::text)
) AS v(role_code, role_name, dept_key)
CROSS JOIN LATERAL (
  SELECT d.id
  FROM "Department" d
  WHERE COALESCE(d."isActive", true) = true
    AND (
      (v.dept_key = 'QUALITY' AND (d."code" = 'QUALITY' OR LOWER(TRIM(d."name")) = 'quality'))
      OR (v.dept_key = 'ORG' AND (d."code" = 'ORG' OR LOWER(TRIM(d."name")) = 'organization'))
      OR (v.dept_key = 'OPS' AND (
           d."code" = 'OPS'
           OR LOWER(TRIM(d."name")) IN ('operations', 'flight operations')
         ))
      OR (v.dept_key = 'SAFETY' AND (d."code" = 'SAFETY' OR LOWER(TRIM(d."name")) = 'safety'))
    )
  ORDER BY d."code"
  LIMIT 1
) AS dept
WHERE NOT EXISTS (
  SELECT 1
  FROM "DepartmentRoleCatalog" x
  WHERE x."departmentId" = dept.id
    AND LOWER(TRIM(x."name")) = LOWER(TRIM(v.role_name))
);
