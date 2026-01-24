# 🛠️ Complete Implementation Plan: Phase 1 Upgrades

**Goal**: Upgrade WKLY Nuts App from a "Calculator" to a "Professional Food Production System".
**Focus**: **Food Safety** (Batch Tracking) and **Business Intelligence** (Price Volatility).

## User Review Required
> [!IMPORTANT]
> **Database Changes**: We will create 2 new tables and modify 1 existing table. You will need to run the provided SQL.

## 1. Feature: Vendor Price History & Volatility (Intelligence)
**Why**: To detect price spikes and auto-suggest "Safety Buffers" in your pricing.

### Database Schema (New Table)
```sql
CREATE TABLE price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    price_per_unit DECIMAL(10,2) NOT NULL,
    unit TEXT,
    changed_by TEXT, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ph_vendor ON price_history(vendor_id, ingredient_name);
```

### Backend Logic (`src/services/supabase.js`)
*   **[MODIFY] `updateVendor(vendor)`**:
    *   Before updating, compare new prices with current DB prices.
    *   If `NewPrice != OldPrice`, insert record into `price_history`.
    *   Then update the `vendors` table.
*   **[NEW] `getPriceVolatility(ingredientName)`**:
    *   Fetch last 12 months history.
    *   Calculate `High`, `Low`, and `Variance %`.

### Frontend UI
*   **[MODIFY] Vendor Management**: Add "History" button next to prices. Show small trend chart.
*   **[MODIFY] Pricing Strategy**: Add "Safety Buffer %" field. Display "Suggested Buffer" calculated from `Variance %`.

---

## 2. Feature: Batch Tracking & Expiry (Food Safety) 🛡️
**Why**: To know exactly which batch of Almonds is expiring soon, effectively moving from "Simple Count" to "FIFO Management".

### Database Schema (New "Ingredients" Table)
*Currently, ingredients are just a JSON blob inside `vendors`. We need a real table to track stock batches.*

```sql
-- Main Ingredients Table (Global List)
CREATE TABLE ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- "Almonds", "Cashews"
    current_stock_total DECIMAL(10,2) DEFAULT 0,
    unit TEXT DEFAULT 'g'
);

-- Batches Table (The actual physical bags in warehouse)
CREATE TABLE ingredient_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id UUID REFERENCES ingredients(id),
    vendor_id UUID REFERENCES vendors(id), 
    batch_number TEXT, -- "BATCH-2026-A"
    quantity_initial DECIMAL(10,2),
    quantity_remaining DECIMAL(10,2),
    expiry_date DATE,
    received_date DATE DEFAULT NOW(),
    status TEXT DEFAULT 'active' -- active, consumed, expired
);
```

### Backend Logic
*   **[NEW] `receiveStock(vendorId, ingredient, quantity, batchNo, expiry)`**:
    *   Creates a new record in `ingredient_batches`.
    *   Updates `ingredients.current_stock_total`.
*   **[MODIFY] Production Deduct Logic**:
    *   Instead of "reduce total stock", implementation will find the **Oldest Active Batch** (First-In-First-Out).
    *   Deduct from that batch. If empty, move to next batch.

### Frontend UI
*   **[NEW] Inventory Page**:
    *   Split into "Summary" (Total Stock) and "Batches" (Details).
    *   Highlight **Expiring Soon** batches in Red.
*   **[MODIFY] Production Calculator**:
    *   Show "Batches Used" summary (e.g., "Using Batch A (Expiring tomorrow) for this run").

---

## 3. Implementation Order
1.  **Price History** (Easier, Quick Win).
2.  **Inventory Schema Migration** (Complex, requires splitting JSON data to new Tables).
3.  **Batch UI** (New inputs for Expiry Dates).

---

## Verification Plan
1.  **Price History**: Change a vendor price -> Check if it appears in "History".
2.  **Batch Tracking**: Add "Batch A" (Expiring Jan) and "Batch B" (Expiring Dec). Run production. Verify "Batch A" stock reduces first.
