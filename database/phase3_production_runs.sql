-- WKLY Nuts Phase 3: Production Runs & SKU Instance Numbering
-- Tracks every production batch with traceability

-- ==========================================
-- PRODUCTION RUNS TABLE
-- Track each production batch
-- ==========================================
CREATE TABLE IF NOT EXISTS production_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number VARCHAR(50) UNIQUE NOT NULL,

  -- SKU being produced
  sku_id UUID,
  sku_name VARCHAR(255) NOT NULL,
  sku_code VARCHAR(20) NOT NULL, -- DP, SO, SC, DB

  -- Production details
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  planned_quantity INTEGER NOT NULL DEFAULT 0,
  actual_quantity INTEGER DEFAULT 0,
  rejected_quantity INTEGER DEFAULT 0,

  -- Pack type
  pack_type VARCHAR(50) DEFAULT 'weekly', -- weekly, monthly

  -- Status pipeline
  status VARCHAR(50) DEFAULT 'planned',
  -- planned → in_progress → quality_check → completed → cancelled

  -- Ingredients used (JSONB array)
  ingredients_used JSONB DEFAULT '[]'::jsonb,
  -- [{ingredient_name, quantity_grams, batch_source}]

  -- Packaging materials used (JSONB array)
  packaging_used JSONB DEFAULT '[]'::jsonb,
  -- [{material_name, quantity, unit}]
  -- e.g. boxes, sachets, nitrogen flush, tape, labels

  -- SKU Instance range (for traceability)
  -- Format: DP-2026-0301-001 to DP-2026-0301-050
  instance_start VARCHAR(50),
  instance_end VARCHAR(50),

  -- Quality check
  quality_status VARCHAR(50) DEFAULT 'pending',
  -- pending, passed, failed, partial
  quality_notes TEXT,
  quality_checked_at TIMESTAMPTZ,

  -- Timings
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Cost tracking
  ingredient_cost DECIMAL(10,2) DEFAULT 0,
  packaging_cost DECIMAL(10,2) DEFAULT 0,
  labor_cost DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  cost_per_unit DECIMAL(10,2) DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE production_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on production_runs" ON production_runs
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_production_runs_batch_date ON production_runs(batch_date);
CREATE INDEX IF NOT EXISTS idx_production_runs_sku_code ON production_runs(sku_code);
CREATE INDEX IF NOT EXISTS idx_production_runs_status ON production_runs(status);

CREATE SEQUENCE IF NOT EXISTS production_run_number_seq START 1;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_production_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_production_runs_updated_at BEFORE UPDATE ON production_runs
  FOR EACH ROW EXECUTE FUNCTION update_production_runs_updated_at();

-- ==========================================
-- SKU INSTANCE COUNTER TABLE
-- Track daily sequential numbers per SKU
-- ==========================================
CREATE TABLE IF NOT EXISTS sku_instance_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code VARCHAR(20) NOT NULL,
  counter_date DATE NOT NULL DEFAULT CURRENT_DATE,
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE(sku_code, counter_date)
);

ALTER TABLE sku_instance_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on sku_instance_counters" ON sku_instance_counters
  FOR ALL USING (true) WITH CHECK (true);

-- Function to get next instance number for a SKU on a given date
-- Returns the next sequential number and updates the counter
CREATE OR REPLACE FUNCTION get_next_sku_instance(p_sku_code VARCHAR, p_date DATE, p_quantity INTEGER)
RETURNS TABLE(start_num INTEGER, end_num INTEGER) AS $$
DECLARE
  current_last INTEGER;
BEGIN
  -- Upsert: insert or update the counter
  INSERT INTO sku_instance_counters (sku_code, counter_date, last_number)
  VALUES (p_sku_code, p_date, p_quantity)
  ON CONFLICT (sku_code, counter_date)
  DO UPDATE SET last_number = sku_instance_counters.last_number + p_quantity
  RETURNING sku_instance_counters.last_number INTO current_last;

  -- Return the range
  start_num := current_last - p_quantity + 1;
  end_num := current_last;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
