-- ============================================================
-- RLS Policy Migration: Lock down all tables
-- ============================================================
-- Current state: All tables have USING (true) WITH CHECK (true)
-- which allows ANY anonymous request to read/write all data.
--
-- This migration replaces those wide-open policies with ones
-- that require the Supabase service_role or an authenticated
-- session (i.e., your app's anon key + valid JWT).
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file and click "Run"
-- ============================================================

-- Helper: list of all application tables
-- We drop existing permissive policies and create restrictive ones.

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  -- Loop through all public tables that have RLS enabled
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- Drop all existing policies on this table
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    -- Ensure RLS is enabled
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Create new policies that allow access only via service_role or authenticated users
    -- SELECT
    EXECUTE format(
      'CREATE POLICY "Authenticated read" ON public.%I FOR SELECT TO authenticated, service_role USING (true)',
      tbl
    );
    -- INSERT
    EXECUTE format(
      'CREATE POLICY "Authenticated insert" ON public.%I FOR INSERT TO authenticated, service_role WITH CHECK (true)',
      tbl
    );
    -- UPDATE
    EXECUTE format(
      'CREATE POLICY "Authenticated update" ON public.%I FOR UPDATE TO authenticated, service_role USING (true) WITH CHECK (true)',
      tbl
    );
    -- DELETE
    EXECUTE format(
      'CREATE POLICY "Authenticated delete" ON public.%I FOR DELETE TO authenticated, service_role USING (true)',
      tbl
    );
  END LOOP;
END $$;

-- Verify: after running, anonymous (anon) role should have NO access
-- You can test by running:
--   SELECT * FROM vendors;
-- while signed out — it should return 0 rows.
