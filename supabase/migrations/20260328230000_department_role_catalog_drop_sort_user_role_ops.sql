-- Remove catalog sort column; allow User.role for ops crew codes from catalog assignment.

ALTER TABLE "DepartmentRoleCatalog" DROP COLUMN IF EXISTS "sortOrder";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'PILOT'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'PILOT';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'CABIN_CREW'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'CABIN_CREW';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'FLIGHT_DISPATCHERS'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'FLIGHT_DISPATCHERS';
  END IF;
END $$;
