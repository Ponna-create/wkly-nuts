-- WKLY Nuts Sales Orders Table
-- Complete order lifecycle tracking from payment to delivery

CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(255),

  -- Order Source & Details
  order_date DATE DEFAULT CURRENT_DATE,
  order_source VARCHAR(50),
  -- whatsapp, website, instagram, meta_ad, walkin, zoho

  -- Items (JSONB array)
  items JSONB DEFAULT '[]'::jsonb,
  -- [{sku_id, sku_name, pack_type, quantity, unit_price, total, sku_instance_numbers: [...]}]

  -- Financials
  subtotal DECIMAL(10,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 5,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  shipping_charge DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,

  -- Payment
  payment_method VARCHAR(50),
  -- upi, cod, bank_transfer, gpay, phonepe
  payment_status VARCHAR(50) DEFAULT 'pending',
  -- pending, received, partial, cod_pending
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  payment_date DATE,
  transaction_id VARCHAR(100),

  -- Status Pipeline
  status VARCHAR(50) DEFAULT 'packing',
  -- follow_up, awaiting_payment, packing, packed, dispatched,
  -- in_transit, delivered, completed, cancelled, returned, refunded

  -- Follow-up (for leads)
  follow_up_date DATE,
  follow_up_notes TEXT,

  -- Shipping
  shipping_address TEXT,
  courier_name VARCHAR(100),
  tracking_number VARCHAR(100),
  dispatch_date DATE,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  shipping_weight DECIMAL(10,3),

  -- QR & Labels
  qr_code_data TEXT,

  -- Linked Records
  invoice_id UUID REFERENCES invoices(id),
  zoho_order_id VARCHAR(100),

  -- Feedback
  feedback_sent BOOLEAN DEFAULT FALSE,
  feedback_rating INTEGER,
  -- 1-5 stars
  feedback_text TEXT,
  feedback_date DATE,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;

-- Allow all operations (app-level password protection)
CREATE POLICY "Allow all operations on sales_orders" ON sales_orders
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_source ON sales_orders(order_source);

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS sales_order_number_seq START 1;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_sales_orders_updated_at();
