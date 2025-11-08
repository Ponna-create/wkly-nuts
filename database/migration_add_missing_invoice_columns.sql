-- Migration: Add missing columns to invoices table if they don't exist
-- This ensures all required columns are present for invoice management

-- Add advance_paid column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'advance_paid'
  ) THEN
    ALTER TABLE invoices ADD COLUMN advance_paid NUMERIC(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add balance_due column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'balance_due'
  ) THEN
    ALTER TABLE invoices ADD COLUMN balance_due NUMERIC(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add gst_rate column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'gst_rate'
  ) THEN
    ALTER TABLE invoices ADD COLUMN gst_rate NUMERIC(5, 2) DEFAULT 5;
  END IF;
END $$;

-- Add gst_amount column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'gst_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN gst_amount NUMERIC(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add discount_percent column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'discount_percent'
  ) THEN
    ALTER TABLE invoices ADD COLUMN discount_percent NUMERIC(5, 2) DEFAULT 0;
  END IF;
END $$;

-- Add discount_amount column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN discount_amount NUMERIC(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add shipping_charge column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'shipping_charge'
  ) THEN
    ALTER TABLE invoices ADD COLUMN shipping_charge NUMERIC(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Verify all columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
ORDER BY ordinal_position;

