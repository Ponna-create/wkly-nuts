-- 1. Create a Master Ingredients Table (Normalization)
-- Currently ingredients are just strings in JSON. We need them to be real entities.
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- e.g., "Almonds", "Sugar"
    current_stock_total DECIMAL(10,2) DEFAULT 0, -- Auto-calculated sum of active batches
    unit TEXT DEFAULT 'kg',
    volatility_score DECIMAL(5,2), -- From our Price History logic
    safety_stock_level DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Batches Table (The Core of Food Safety)
CREATE TABLE IF NOT EXISTS ingredient_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id), -- Which vendor supplied this specific batch
    
    batch_number TEXT, -- e.g., "BATCH-2026-001" or Manufacturer's Lot #
    expiry_date DATE, -- CRITICAL for food safety
    received_date DATE DEFAULT CURRENT_DATE,
    
    quantity_initial DECIMAL(10,2) NOT NULL, -- How much we bought
    quantity_remaining DECIMAL(10,2) NOT NULL, -- How much is left
    price_per_unit DECIMAL(10,2), -- Price of THIS specific batch (Cost Basis)
    
    status TEXT DEFAULT 'active', -- 'active', 'consumed', 'expired', 'quarantined'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_batches_ingredient ON ingredient_batches(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON ingredient_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_status ON ingredient_batches(status);

-- Comments
COMMENT ON TABLE ingredient_batches IS 'Tracks specific physical bags of ingredients with expiry and cost basis (FIFO)';
