-- Migration: Add single_units_available to inventory + inventory_transactions table

-- 1. Add single_units_available column to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS single_units_available NUMERIC(10, 2) DEFAULT 0;

-- 2. Create inventory_transactions table for audit trail
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_id UUID REFERENCES skus(id) ON DELETE SET NULL,
  pack_type VARCHAR(20) NOT NULL, -- 'weekly', 'monthly', 'single', '0.5kg', '1kg'
  quantity NUMERIC(10, 2) NOT NULL,
  operation VARCHAR(10) NOT NULL, -- 'add' or 'subtract'
  reason TEXT, -- e.g., 'Order ORD-2026-00045' or 'Production PR-001'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_inv_transactions_sku ON inventory_transactions(sku_id);
CREATE INDEX IF NOT EXISTS idx_inv_transactions_date ON inventory_transactions(created_at DESC);

-- Enable RLS (match existing pattern)
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (match existing pattern)
CREATE POLICY "Allow all for authenticated" ON inventory_transactions
  FOR ALL USING (true) WITH CHECK (true);
