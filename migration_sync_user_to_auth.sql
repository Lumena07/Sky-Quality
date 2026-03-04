-- ============================================
-- Migration: Sync public."User".id with auth.users.id
-- ============================================
-- Run this in Supabase SQL Editor AFTER running scripts/sync-auth-users.mjs
-- so that auth users exist for every email in public."User".
--
-- Prerequisite: For each row in public."User" there must be a row in auth.users with the same email.

DO $$
DECLARE
  r RECORD;
  sql TEXT;
BEGIN
  -- Step 1: Save FK constraint definitions that reference "User"(id), then drop them
  CREATE TEMP TABLE IF NOT EXISTS _user_fk_backup (
    table_schema text,
    table_name text,
    constraint_name text,
    column_name text,
    delete_rule text,
    update_rule text
  );
  DELETE FROM _user_fk_backup;

  INSERT INTO _user_fk_backup (table_schema, table_name, constraint_name, column_name, delete_rule, update_rule)
  SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    COALESCE(rc.delete_rule, 'NO ACTION'),
    COALESCE(rc.update_rule, 'NO ACTION')
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'User'
    AND ccu.column_name = 'id'
    AND tc.table_name != 'User';

  FOR r IN SELECT table_schema, table_name, constraint_name FROM _user_fk_backup
  LOOP
    sql := format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.table_schema, r.table_name, r.constraint_name);
    RAISE NOTICE 'Dropping FK: %', r.constraint_name;
    EXECUTE sql;
  END LOOP;

  -- Step 2: Update all tables that reference "User"(id): set FK column to auth.users.id (by email match)
  FOR r IN
    SELECT b.table_schema, b.table_name, b.column_name
    FROM _user_fk_backup b
  LOOP
    sql := format(
      'UPDATE %I.%I AS t SET %I = (SELECT a.id::text FROM auth.users a WHERE a.email = (SELECT u.email FROM public."User" u WHERE u.id = t.%I)) WHERE t.%I IN (SELECT id FROM public."User")',
      r.table_schema, r.table_name, r.column_name, r.column_name, r.column_name
    );
    RAISE NOTICE 'Updating %.%(%)', r.table_schema, r.table_name, r.column_name;
    EXECUTE sql;
  END LOOP;

  -- Step 3: Update public."User": set id = auth.users.id where email matches
  UPDATE public."User" u
  SET id = (SELECT a.id::text FROM auth.users a WHERE a.email = u.email)
  WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.email = u.email);

  RAISE NOTICE 'User.id synced to auth.users.id. Recreating FKs...';

  -- Step 4: Re-create FK constraints with original delete/update rules
  FOR r IN SELECT * FROM _user_fk_backup
  LOOP
    sql := format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public."User"(id) ON DELETE %s ON UPDATE %s',
      r.table_schema, r.table_name, r.constraint_name, r.column_name, r.delete_rule, r.update_rule
    );
    RAISE NOTICE 'Adding FK: %', r.constraint_name;
    EXECUTE sql;
  END LOOP;

  DROP TABLE _user_fk_backup;
  RAISE NOTICE 'Done.';
END $$;
