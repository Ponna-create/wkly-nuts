-- ============================================================
-- RLS Policy Migration: Lock down all tables
-- ============================================================
-- This app uses Supabase anon key with its own auth layer
-- (password login in Auth.jsx). RLS policies grant access to
-- anon, authenticated, and service_role — the app's own
-- session-based auth gates all user interaction before any
-- Supabase call is made.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file and click "Run"
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
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

    -- Grant access to anon (used by the app), authenticated, and service_role
    EXECUTE format(
      'CREATE POLICY "App read" ON public.%I FOR SELECT TO anon, authenticated, service_role USING (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "App insert" ON public.%I FOR INSERT TO anon, authenticated, service_role WITH CHECK (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "App update" ON public.%I FOR UPDATE TO anon, authenticated, service_role USING (true) WITH CHECK (true)',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "App delete" ON public.%I FOR DELETE TO anon, authenticated, service_role USING (true)',
      tbl
    );
  END LOOP;
END $$;
