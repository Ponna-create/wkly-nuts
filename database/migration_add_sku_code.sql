-- Migration: Add sku_code column to skus table
-- This allows SKU codes (DP, SO, SC, DB, etc.) to be stored on the SKU record
-- instead of being hardcoded in the frontend

ALTER TABLE skus ADD COLUMN IF NOT EXISTS sku_code VARCHAR(10);

-- Populate existing SKUs with known codes
UPDATE skus SET sku_code = 'DP' WHERE LOWER(name) LIKE '%day pack%' AND sku_code IS NULL;
UPDATE skus SET sku_code = 'SO' WHERE LOWER(name) LIKE '%soak overnight%' AND sku_code IS NULL;
UPDATE skus SET sku_code = 'SC' WHERE LOWER(name) LIKE '%seed cycle%' AND sku_code IS NULL;
UPDATE skus SET sku_code = 'DB' WHERE LOWER(name) LIKE '%date bytes%' AND sku_code IS NULL;
