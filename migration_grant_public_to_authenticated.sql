-- ============================================
-- Fix: permission denied for schema public (authenticated / anon)
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor.
--
-- Your app uses the anon key with the user's JWT; Supabase runs those requests
-- as the "authenticated" role. Table Editor impersonation also uses these roles.
-- Without these grants, you get "permission denied for schema public" and rows don't load.

-- Allow authenticated and anon roles to use the public schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Allow them to read/write all existing tables in public
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;

-- Allow them to use sequences (for id generation) if any
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Optional: new tables created in public get these permissions too
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
