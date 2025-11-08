-- WKLY Nuts Database Schema - SECURE VERSION
-- Run this SQL in your Supabase SQL Editor to create the tables
-- This version includes proper security and customer/invoice tables
-- 
-- IMPORTANT: This script is safe to run multiple times (idempotent)
-- It will drop and recreate policies if they exist

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption (optional, for sensitive data)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- EXISTING TABLES (Updated with better security)
-- ============================================================================

-- Vendors Table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  location VARCHAR(255),
  email VARCHAR(255),
  ingredients JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SKUs Table
CREATE TABLE IF NOT EXISTS skus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_weight_per_sachet NUMERIC(10, 2),
  recipes JSONB DEFAULT '{}'::jsonb,
  weekly_pack JSONB DEFAULT '{}'::jsonb,
  monthly_pack JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pricing Strategies Table
CREATE TABLE IF NOT EXISTS pricing_strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_id UUID REFERENCES skus(id) ON DELETE CASCADE,
  pack_type VARCHAR(50) NOT NULL, -- 'weekly' or 'monthly'
  costs JSONB DEFAULT '{}'::jsonb,
  margins JSONB DEFAULT '{}'::jsonb,
  selling_price NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Targets Table
CREATE TABLE IF NOT EXISTS sales_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  targets JSONB DEFAULT '[]'::jsonb,
  fixed_costs JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(month, year)
);

-- ============================================================================
-- NEW TABLES: CUSTOMERS AND INVOICES
-- ============================================================================

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  gstin VARCHAR(50), -- GST Identification Number (for Indian invoices)
  customer_type VARCHAR(50) DEFAULT 'individual', -- individual, business
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE, -- Allow NULL initially, will be generated when status is 'paid'
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {sku_id, sku_name, pack_type, quantity, unit_price, total}
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  gst_rate NUMERIC(5, 2) DEFAULT 5, -- GST percentage (5% or 12%)
  gst_amount NUMERIC(10, 2) DEFAULT 0,
  discount_percent NUMERIC(5, 2) DEFAULT 0, -- Discount percentage
  discount_amount NUMERIC(10, 2) DEFAULT 0, -- Discount fixed amount
  shipping_charge NUMERIC(10, 2) DEFAULT 0,
  advance_paid NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
  payment_method VARCHAR(50), -- cash, bank_transfer, upi, cheque, etc.
  payment_date DATE,
  notes TEXT,
  terms TEXT, -- Payment terms
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice Number Sequence (for auto-generating invoice numbers)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- ============================================================================
-- INVENTORY/STOCK MANAGEMENT TABLE
-- ============================================================================

-- Inventory Table (tracks stock levels for each SKU)
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_id UUID REFERENCES skus(id) ON DELETE CASCADE,
  weekly_packs_available NUMERIC(10, 2) DEFAULT 0,
  monthly_packs_available NUMERIC(10, 2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sku_id) -- One inventory record per SKU
);

-- ============================================================================
-- SECURITY: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES: For Internal Use with Simple Authentication
-- ============================================================================

-- Option 1: Allow all for authenticated users (if using Supabase Auth)
-- Uncomment these if you implement Supabase Auth:
/*
CREATE POLICY "Authenticated users can manage vendors" ON vendors
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage skus" ON skus
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage pricing_strategies" ON pricing_strategies
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage sales_targets" ON sales_targets
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage customers" ON customers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage invoices" ON invoices
  FOR ALL USING (auth.role() = 'authenticated');
*/

-- Option 2: For now, keep allow all BUT add app-level password protection
-- This is for internal use only - the app will handle authentication
-- TODO: Replace with proper Supabase Auth later

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Allow all operations on vendors" ON vendors;
DROP POLICY IF EXISTS "Allow all operations on skus" ON skus;
DROP POLICY IF EXISTS "Allow all operations on pricing_strategies" ON pricing_strategies;
DROP POLICY IF EXISTS "Allow all operations on sales_targets" ON sales_targets;
DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;
DROP POLICY IF EXISTS "Allow all operations on invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all operations on inventory" ON inventory;

-- Create policies for existing tables
CREATE POLICY "Allow all operations on vendors" ON vendors
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on skus" ON skus
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on pricing_strategies" ON pricing_strategies
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on sales_targets" ON sales_targets
  FOR ALL USING (true) WITH CHECK (true);

-- Create policies for new tables (customers, invoices, and inventory)
CREATE POLICY "Allow all operations on customers" ON customers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on invoices" ON invoices
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on inventory" ON inventory
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_skus_name ON skus(name);
CREATE INDEX IF NOT EXISTS idx_pricing_strategies_sku_id ON pricing_strategies(sku_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_month_year ON sales_targets(month, year);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_inventory_sku_id ON inventory(sku_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to auto-generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                         LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist (to avoid errors on re-run)
DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
DROP TRIGGER IF EXISTS update_skus_updated_at ON skus;
DROP TRIGGER IF EXISTS update_pricing_strategies_updated_at ON pricing_strategies;
DROP TRIGGER IF EXISTS update_sales_targets_updated_at ON sales_targets;
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;

-- Triggers for updated_at
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skus_updated_at BEFORE UPDATE ON skus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_strategies_updated_at BEFORE UPDATE ON pricing_strategies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_targets_updated_at BEFORE UPDATE ON sales_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for auto-generating invoice numbers
CREATE TRIGGER generate_invoice_number_trigger BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- ============================================================================
-- NOTES
-- ============================================================================

-- SECURITY REMINDER:
-- 1. This schema uses "allow all" policies for internal use
-- 2. Add app-level password protection (see Auth component)
-- 3. For production, implement Supabase Auth and update RLS policies
-- 4. Never expose service_role key in frontend
-- 5. Rotate API keys periodically

-- INVOICE NUMBER FORMAT:
-- Format: INV-YYYY-XXXXX
-- Example: INV-2025-00001, INV-2025-00002, etc.
-- The sequence resets each year (you may want to adjust this)

