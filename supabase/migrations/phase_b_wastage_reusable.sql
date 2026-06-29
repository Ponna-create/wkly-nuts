-- Phase B: Add is_reusable column to production_wastage
ALTER TABLE production_wastage ADD COLUMN IF NOT EXISTS is_reusable BOOLEAN DEFAULT false;
