-- Phase 6: Inventory Flow - RLS policies for ingredients tables
-- Run this in Supabase SQL Editor

-- Ensure RLS is enabled and policies exist for ingredients
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Allow all on ingredients" ON ingredients FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure RLS for ingredient_batches
ALTER TABLE ingredient_batches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Allow all on ingredient_batches" ON ingredient_batches FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure RLS for inventory table
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Allow all on inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for fast ingredient name lookups
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);

-- Index for fast zoho_order_id lookups (duplicate detection on import)
CREATE INDEX IF NOT EXISTS idx_sales_orders_zoho_id ON sales_orders(zoho_order_id);
