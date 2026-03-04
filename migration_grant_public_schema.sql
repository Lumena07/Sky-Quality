-- ============================================
-- Fix: permission denied for schema public
-- ============================================
-- Run this once in Supabase Dashboard → SQL Editor
-- so the service_role key can read/write public tables (e.g. for sync-auth-users script).

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Optional: allow new tables created in public to be accessible too
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
