-- Phase 4: Packaging Materials Inventory
-- Run this in Supabase SQL Editor

-- ==========================================
-- PACKAGING MATERIALS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS packaging_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  -- box_weekly, box_monthly, sachet, tape, nitrogen, label, sticker, zipper_bag, other
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  cost_per_unit NUMERIC DEFAULT 0,
  vendor_name TEXT,
  last_purchase_date DATE,
  last_purchase_qty NUMERIC DEFAULT 0,
  last_purchase_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- PACKAGING TRANSACTIONS TABLE (stock movements)
-- ==========================================
CREATE TABLE IF NOT EXISTS packaging_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES packaging_materials(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'purchase',
  -- purchase, usage, adjustment, return
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  production_run_id UUID,
  reference_note TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_packaging_materials_category ON packaging_materials(category);
CREATE INDEX IF NOT EXISTS idx_packaging_transactions_material ON packaging_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_packaging_transactions_date ON packaging_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_packaging_transactions_type ON packaging_transactions(type);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE packaging_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for packaging_materials
CREATE POLICY "Enable all for authenticated users" ON packaging_materials
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Policies for packaging_transactions
CREATE POLICY "Enable all for authenticated users" ON packaging_transactions
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ==========================================
-- UPDATED_AT TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION update_packaging_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_packaging_materials_updated_at
  BEFORE UPDATE ON packaging_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_packaging_materials_updated_at();

-- ==========================================
-- SEED DATA - Common packaging materials for WKLY Nuts
-- ==========================================
INSERT INTO packaging_materials (name, category, unit, current_stock, min_stock, cost_per_unit, notes)
VALUES
  ('Weekly Box (21.6x14.0x10.2cm)', 'box_weekly', 'pcs', 0, 50, 11, 'Standard weekly pack box'),
  ('Monthly Box (26.7x20.3x21.6cm)', 'box_monthly', 'pcs', 0, 20, 20, 'Monthly pack box - holds 4 weekly boxes'),
  ('Day Pack Sachet', 'sachet', 'pcs', 0, 200, 0, 'Individual day pack sachet'),
  ('Soak Overnight Sachet', 'sachet', 'pcs', 0, 200, 0, 'Soak overnight sachet'),
  ('Seed Cycle Sachet', 'sachet', 'pcs', 0, 200, 0, 'Seed cycle sachet'),
  ('Date Bytes Sachet', 'sachet', 'pcs', 0, 200, 0, 'Date bytes sachet'),
  ('Packing Tape', 'tape', 'rolls', 0, 5, 0, 'Brown/branded packing tape'),
  ('Nitrogen Gas', 'nitrogen', 'kg', 0, 2, 0, 'For nitrogen flushing sachets'),
  ('Product Label - Day Pack', 'label', 'pcs', 0, 200, 0, 'Printed label for Day Pack'),
  ('Product Label - Soak Overnight', 'label', 'pcs', 0, 200, 0, 'Printed label for Soak Overnight'),
  ('Product Label - Seed Cycle', 'label', 'pcs', 0, 200, 0, 'Printed label for Seed Cycle'),
  ('Product Label - Date Bytes', 'label', 'pcs', 0, 200, 0, 'Printed label for Date Bytes'),
  ('Shipping Label (4x6)', 'label', 'pcs', 0, 100, 0, 'Thermal shipping labels for Helett H30C')
ON CONFLICT DO NOTHING;
