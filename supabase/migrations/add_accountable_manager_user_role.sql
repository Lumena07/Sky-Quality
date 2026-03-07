-- Add ACCOUNTABLE_MANAGER to UserRole enum so User.role can be set when roles = ['ACCOUNTABLE_MANAGER'].
-- Run this in Supabase SQL Editor if you get: invalid input value for enum "UserRole": "ACCOUNTABLE_MANAGER"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typname = 'UserRole' AND e.enumlabel = 'ACCOUNTABLE_MANAGER'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'ACCOUNTABLE_MANAGER';
  END IF;
END $$;
