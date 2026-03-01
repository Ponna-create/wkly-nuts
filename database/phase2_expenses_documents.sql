-- WKLY Nuts Phase 2: Expenses, Documents, Purchase Orders

-- ==========================================
-- EXPENSES TABLE
-- Track all business expenses
-- ==========================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number VARCHAR(50) UNIQUE NOT NULL,

  -- Category
  category VARCHAR(50) NOT NULL,
  -- raw_materials, packaging, shipping, advertising, rent, utilities,
  -- equipment, salary, courier, misc

  subcategory VARCHAR(100),
  description TEXT,

  -- Vendor/Payee
  vendor_id UUID REFERENCES vendors(id),
  vendor_name VARCHAR(255),
  payee_name VARCHAR(255),

  -- Amount
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Payment
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'paid',
  transaction_id VARCHAR(100),
  payment_date DATE DEFAULT CURRENT_DATE,

  -- Bill/Receipt
  bill_number VARCHAR(100),
  bill_date DATE,
  bill_image_url TEXT,

  -- Linked records
  purchase_order_id UUID,
  sales_order_id UUID REFERENCES sales_orders(id),

  -- OCR extracted data (future)
  ocr_data JSONB,

  notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency VARCHAR(20), -- weekly, monthly, yearly

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on expenses" ON expenses
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_date ON expenses(payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor_id ON expenses(vendor_id);

CREATE SEQUENCE IF NOT EXISTS expense_number_seq START 1;

-- ==========================================
-- DOCUMENTS TABLE
-- Store all business documents and images
-- ==========================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  document_type VARCHAR(50),
  -- bill, receipt, invoice, label, photo, contract, license, misc

  -- File
  file_url TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,
  file_type VARCHAR(50), -- image/jpeg, application/pdf, etc.

  -- Linked records
  expense_id UUID REFERENCES expenses(id),
  vendor_id UUID REFERENCES vendors(id),
  sales_order_id UUID REFERENCES sales_orders(id),

  -- Tags for searching
  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on documents" ON documents
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_expense_id ON documents(expense_id);

-- ==========================================
-- PURCHASE ORDERS TABLE
-- Track raw material purchases from vendors
-- ==========================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL,

  -- Vendor
  vendor_id UUID REFERENCES vendors(id),
  vendor_name VARCHAR(255),

  -- Order details
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,

  -- Items (JSONB array)
  items JSONB DEFAULT '[]'::jsonb,
  -- [{ingredient_name, quantity_kg, unit_price, total}]

  -- Financials
  subtotal DECIMAL(10,2) DEFAULT 0,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  shipping_charge DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,

  -- Payment
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  amount_paid DECIMAL(10,2) DEFAULT 0,
  payment_date DATE,
  transaction_id VARCHAR(100),

  -- Status
  status VARCHAR(50) DEFAULT 'ordered',
  -- draft, ordered, confirmed, shipped, received, partially_received, cancelled

  -- Bill
  bill_number VARCHAR(100),
  bill_image_url TEXT,

  -- Quality check
  quality_notes TEXT,

  -- Linked
  expense_id UUID REFERENCES expenses(id),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on purchase_orders" ON purchase_orders
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date);

CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS expense_number_seq_v2 START 1;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_expenses_updated_at();

CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_updated_at();

CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_purchase_orders_updated_at();
