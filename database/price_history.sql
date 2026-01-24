-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    price_per_unit DECIMAL(10,2) NOT NULL,
    unit TEXT,
    changed_by TEXT, -- optional, if we had user auth
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by vendor/ingredient
CREATE INDEX IF NOT EXISTS idx_price_history_vendor ON price_history(vendor_id, ingredient_name);

-- Comment
COMMENT ON TABLE price_history IS 'Tracks historical price changes for vendor ingredients';
