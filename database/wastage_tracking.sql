-- ============================================
-- WASTAGE TRACKING TABLE
-- Records scrap, broken, dust, spillage per production run
-- ============================================

CREATE TABLE IF NOT EXISTS production_wastage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_run_id UUID NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  waste_quantity_grams NUMERIC(10, 2) NOT NULL DEFAULT 0,
  waste_type TEXT NOT NULL DEFAULT 'other'
    CHECK (waste_type IN ('broken', 'dust', 'spillage', 'expired', 'quality_reject', 'other')),
  cost_impact NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by production run
CREATE INDEX IF NOT EXISTS idx_wastage_run_id ON production_wastage(production_run_id);

-- Index for reporting by ingredient
CREATE INDEX IF NOT EXISTS idx_wastage_ingredient ON production_wastage(ingredient_name);

-- RLS: Enable Row Level Security
ALTER TABLE production_wastage ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (same pattern as other tables)
CREATE POLICY "Allow all for authenticated users" ON production_wastage
  FOR ALL USING (true) WITH CHECK (true);
