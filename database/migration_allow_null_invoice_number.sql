-- Migration: Allow NULL for invoice_number field
-- This allows invoices to be created without an invoice number initially
-- Invoice numbers will be generated when status changes to 'paid'

-- Drop the NOT NULL constraint on invoice_number
ALTER TABLE invoices 
  ALTER COLUMN invoice_number DROP NOT NULL;

-- Note: The UNIQUE constraint remains, so NULL values are allowed but duplicate invoice numbers are not

