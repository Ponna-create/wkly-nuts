-- ============================================================
-- Cleanup: Merge duplicate customers (same phone number)
-- ============================================================
-- This keeps the FIRST customer created (oldest) for each phone,
-- reassigns all orders from duplicates to the kept customer,
-- then deletes the duplicates.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file and click "Run"
-- ============================================================

-- Step 1: Find duplicates and reassign orders to the original customer
WITH phone_groups AS (
  SELECT
    REGEXP_REPLACE(phone, '[^0-9]', '', 'g') AS clean_phone,
    MIN(created_at) AS first_created
  FROM customers
  WHERE phone IS NOT NULL AND phone != ''
  GROUP BY REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
  HAVING COUNT(*) > 1
),
keeper AS (
  SELECT DISTINCT ON (REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'))
    c.id AS keep_id,
    REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') AS clean_phone
  FROM customers c
  JOIN phone_groups pg ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = pg.clean_phone
  ORDER BY REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), c.created_at ASC
),
duplicates AS (
  SELECT c.id AS dup_id, k.keep_id
  FROM customers c
  JOIN keeper k ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = k.clean_phone
  WHERE c.id != k.keep_id
)
UPDATE sales_orders so
SET customer_id = d.keep_id,
    customer_name = (SELECT name FROM customers WHERE id = d.keep_id)
FROM duplicates d
WHERE so.customer_id = d.dup_id;

-- Step 2: Update invoices too
WITH phone_groups AS (
  SELECT
    REGEXP_REPLACE(phone, '[^0-9]', '', 'g') AS clean_phone
  FROM customers
  WHERE phone IS NOT NULL AND phone != ''
  GROUP BY REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
  HAVING COUNT(*) > 1
),
keeper AS (
  SELECT DISTINCT ON (REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'))
    c.id AS keep_id,
    REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') AS clean_phone
  FROM customers c
  JOIN phone_groups pg ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = pg.clean_phone
  ORDER BY REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), c.created_at ASC
),
duplicates AS (
  SELECT c.id AS dup_id, k.keep_id
  FROM customers c
  JOIN keeper k ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = k.clean_phone
  WHERE c.id != k.keep_id
)
UPDATE invoices inv
SET customer_id = d.keep_id
FROM duplicates d
WHERE inv.customer_id = d.dup_id;

-- Step 3: Delete duplicate customers (orders already reassigned)
WITH phone_groups AS (
  SELECT
    REGEXP_REPLACE(phone, '[^0-9]', '', 'g') AS clean_phone
  FROM customers
  WHERE phone IS NOT NULL AND phone != ''
  GROUP BY REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
  HAVING COUNT(*) > 1
),
keeper AS (
  SELECT DISTINCT ON (REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'))
    c.id AS keep_id,
    REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') AS clean_phone
  FROM customers c
  JOIN phone_groups pg ON REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = pg.clean_phone
  ORDER BY REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), c.created_at ASC
)
DELETE FROM customers c
USING keeper k
WHERE REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') = k.clean_phone
  AND c.id != k.keep_id;

-- Step 4: Delete the bad "41 orders" import (customer name = "41 orders")
DELETE FROM sales_orders WHERE customer_name = '41 orders';
