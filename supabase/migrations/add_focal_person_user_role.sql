-- Add FOCAL_PERSON to UserRole enum so User.role can be set when roles = ['FOCAL_PERSON'].
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'FOCAL_PERSON'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'FOCAL_PERSON';
  END IF;
END $$;
