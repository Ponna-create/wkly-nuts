# WKLY Nuts - Complete Business OS Plan (FINAL)

## Vision
One app to run the entire WKLY Nuts business. A leak-proof, Zoho-quality system that tracks every rupee, every gram, every order from raw material purchase to customer delivery + feedback.

---

## PART 1: THE 6 PILLARS OF THE SYSTEM

```
 1. SALES ORDERS     - Customer orders, payment, follow-ups
 2. PURCHASE          - Raw material buying, vendor bills, price tracking
 3. PRODUCTION        - Making products, SKU numbering, consuming raw materials
 4. DISPATCH          - Packing, label printing, QR scanning, courier tracking
 5. INVENTORY         - Raw materials + Finished goods + Packaging materials
 6. EXPENSES & DOCS   - Every business expense tracked, bills stored
```

---

## PART 2: COMPLETE PROCESS FLOWS

### FLOW 1: SALES ORDERS (Daily order lifecycle)

```
ENQUIRY / FOLLOW-UP (lead that hasn't paid yet)
  Wife creates follow-up in app with reminder date
  App shows daily reminders: "Follow up with Karunakaran about Day Pack"
  When customer pays → Convert to Order with one click
     │
     ▼
PAYMENT RECEIVED → Create Order in App
  Select/Create customer
  Add items: Day Pack Weekly x2, Seed Cycle Monthly x1
  Payment: UPI, amount, transaction ID
  Source: WhatsApp / Website / Instagram / Meta Ad / Walk-in
  ► Status = PACKING
  ► Invoice auto-generated
     │
     ▼
4:00 PM — PACKING
  Open "Today's Packing List"
  Pack each order
  Click "Print Label" → prints address label (A4 or 4x6 thermal)
  Label includes: QR/barcode with Order ID, customer address, order details, weight
  ► Status = PACKED (changes when Print clicked)
  ► QR code generated with Order ID encoded
     │
     ▼
5:30-7:00 PM — COURIER PICKUP
  Scan QR on each parcel with phone camera → auto-finds order
  Bulk scan: scan → scan → scan (rapid scanning mode)
  ► Status = DISPATCHED (on scan)
  ► Inventory auto-deducted (finished goods + packaging materials)
     │
     ▼
9:30-10:00 PM — TRACKING NUMBERS
  Courier sends bill/list with tracking numbers
  OPTION A: Upload courier bill photo → match tracking to orders
  OPTION B: Bulk entry table (Order ID → Tracking Number)
  Match by Order ID written on parcel, or by customer name
  ► Status = IN_TRANSIT
  ► WhatsApp messages auto-generated for all customers
  ► Wife taps "Open WhatsApp" for each → presses Send
     │
     ▼
DELIVERY TRACKING
  Manual: Check & mark delivered
  Future: Auto-check courier website for delivery status
  ► Status = DELIVERED
     │
     ▼
FEEDBACK
  App generates feedback message 1 day after delivery
  "Hi! Hope you enjoyed your WKLY Nuts! Rate us..."
  Wife sends via WhatsApp (semi-automated)
  ► Status = COMPLETED
```

**Other statuses:** CANCELLED, RETURNED, REFUNDED, COD_PENDING

**COD Flow:** Same as above but payment_status = 'cod_pending' until delivery, then record payment after delivery.

**Website/Zoho Import:** Import CSV/Excel from Zoho Commerce → auto-creates orders in pipeline with correct status mapping.

---

### FLOW 2: PURCHASE (Raw Materials IN)

```
Step 1: Wife orders from vendor (phone/WhatsApp)
  Create Purchase Order in app:
  - Select vendor: "Jagan Nuts"
  - Add items: Almonds 5kg @ Rs.800/kg, Cashews 3kg @ Rs.1200/kg
  - Total: Rs.7,600
  - Mark as "Paid" with payment method
  ► Status = ORDERED

Step 2: Goods arrive
  Mark as "Received"
  - Enter actual quantities received
  - Enter batch number, expiry date for each ingredient
  ► Auto-creates ingredient batches (existing system)
  ► Auto-updates ingredient stock levels
  ► Auto-logs price to price_history for YoY comparison
  ► Status = RECEIVED

Step 3: Upload vendor bill
  Take photo of bill (e.g., Jagan Nuts handwritten bill)
  Upload to app → stored in Documents
  OPTION: OCR extracts items/amounts (Google Cloud Vision API - free tier: 1000/month)
  OR manual entry: bill number, date, amount
  System tallies: PO amount vs Bill amount (flag if mismatch)
  ► Status = BILLED
```

---

### FLOW 3: PRODUCTION (Making Products)

```
Step 1: Create Production Run
  Wife enters: "20 Day Pack weekly, 5 Soak Overnight weekly, 20 Seed Cycle weekly"
  Can enter multiple SKUs in one production run

  System auto-calculates:
  - Raw materials needed (from SKU recipes)
  - "Need: Almonds 4.2kg, Cashews 3kg, Walnuts 1.8kg..."
  - Current stock vs required (warns if short)
  - Packaging needed: 45 sachets, 45 stickers, 45 boxes, nitrogen etc.

Step 2: Confirm & Produce
  Click "Start Production"
  ► Raw materials auto-deducted (FIFO from oldest batches)
  ► Packaging materials auto-deducted

Step 3: Complete Production
  Enter actual output: 20 Day Pack, 4 Soak Overnight (1 wasted), 20 Seed Cycle
  ► Each unit gets SKU instance number:
      DP-2026-0301-001 through DP-2026-0301-020 (Day Pack, March 1st, units 1-20)
      SO-2026-0301-001 through SO-2026-0301-004 (Soak Overnight)
      SC-2026-0301-001 through SC-2026-0301-020 (Seed Cycle)
  ► Finished goods inventory updated (+20 DP weekly, +4 SO weekly, +20 SC weekly)
  ► Production cost calculated (materials + packaging + labour)
  ► Cost per unit recorded
  ► Status = COMPLETED
```

---

### FLOW 4: INVENTORY (3 Categories)

```
CATEGORY 1: RAW MATERIALS (Ingredients)
  Already built: ingredient batches with expiry, FIFO, safety stock levels
  Enhanced: auto-deduct on production, auto-add on purchase receipt
  Track: Almonds 5kg, Cashews 3kg, Walnuts 2kg, Dates 1kg, Seeds 2kg...

CATEGORY 2: FINISHED GOODS (Products ready to ship)
  Already built: weekly/monthly packs per SKU
  Enhanced: auto-add on production completion, auto-deduct on dispatch (scan)
  Track: Day Pack Weekly x20, Soak Overnight Weekly x4, Seed Cycle Weekly x20
  Monthly pack = 4x weekly (system handles conversion)
  Each unit has SKU instance number for traceability

CATEGORY 3: PACKAGING MATERIALS (NEW)
  Track separately with inventory levels:
  - Sachets (single sachet covers) — Rs.6.50 each
  - Outer box cover (weekly) — Rs.17 each
  - Stickers (product label) — Rs.6 each
  - Nitrogen fills — Rs.2 each
  - MRP print labels — Rs.0.20 each
  - Address printout paper — Rs.1 each
  - Standing pouches (Seed Cycle) — Rs.4.50 each
  - 3-Ply boxes:
      Weekly box (21.6 x 14.0 x 10.2 cm) — Rs.11 each
      Monthly box (26.7 x 20.3 x 21.6 cm) — Rs.20 each
  - Tape — track by roll, cost per roll
  - Bubble wrap / packaging cover — track by meter, cost per meter

  Auto-deduct packaging on dispatch (based on pack type):
    Weekly order = 1 weekly box + tape + wrapper
    Monthly order = 1 monthly box + tape + wrapper

  Low stock alerts: "Only 5 weekly boxes left, reorder!"
```

---

### FLOW 5: EXPENSES & DOCUMENTS (Complete Business Tracking)

```
EXPENSE CATEGORIES:
  - Raw Materials (auto from Purchase Orders)
  - Packaging Materials (auto from inventory usage)
  - Shipping/Courier (from dispatch records)
  - Meta Ads (manual entry: Rs.150/day or monthly total)
  - Labour (monthly salary/wages)
  - Rent/Storage
  - Equipment/Machinery
  - Printer/Stationery
  - GST/Tax Payments
  - Miscellaneous

DOCUMENT STORAGE:
  - Upload any image/PDF: vendor bills, courier bills, receipts
  - Categorize: Purchase Bill, Courier Bill, Tax Receipt, Other
  - Link to: Purchase Order, Sales Order, or standalone
  - Searchable by date, vendor, category, amount
  - Like a simple Google Drive for business documents

FUTURE: OCR (Image to Data)
  - Upload vendor bill photo
  - Google Cloud Vision API (free: 1000 images/month) extracts text
  - System parses: vendor name, items, quantities, amounts
  - Auto-fills purchase order or expense entry
  - Wife just reviews and confirms
```

---

## PART 3: LABEL PRINTING SYSTEM

### Two Formats Supported

**Format 1: A4 Paper (current printer)**
- 2 labels per A4 page (one for parcel, one for records)
- Standard layout with all order details

**Format 2: 4x6 Thermal Label (Helett H30C Lite - planned)**
- Direct thermal print, no ink needed
- Professional shipping label with barcode/QR

### Label Content

```
┌─────────────────────────────────────────────┐
│ [QR CODE]  WKLY NUTS                        │
│            Order: SO-2026-00045              │
│                                              │
│ TO:                                          │
│ Dr. Vinod Nathaniel                          │
│ Gift of Sight Nursing Home                   │
│ Simco Meter Road, David Colony               │
│ KK Nagar, Trichy 620021                      │
│ Ph: 9843720348                               │
│                                              │
│ FROM:                                        │
│ Priya M (WKLY Nuts)                          │
│ 26/S1 VGN Platina, Ambigai Nagar             │
│ Ayyapakkam, Chennai 600077                   │
│ Ph: 7619302303                               │
│ ─────────────────────────────────────────── │
│ Items: Monthly Day Pack x1                   │
│ Weight: 1.410 kg  │  COD / PREPAID          │
│ Date: 28/02/2026                             │
└─────────────────────────────────────────────┘
```

### Print Trigger
- When wife clicks "Print Label" → label generated
- Status auto-changes: PACKING → PACKED
- Both formats available (A4 / 4x6) — configurable in Settings

---

## PART 4: SKU INSTANCE NUMBERING

### How It Works

When production run completes, each unit gets a unique number:

```
Format: [SKU_CODE]-[YEAR]-[MMDD]-[SEQUENCE]

Examples:
  DP-2026-0301-001  = Day Pack, 2026, March 1st, unit 1
  DP-2026-0301-020  = Day Pack, 2026, March 1st, unit 20
  SO-2026-0301-001  = Soak Overnight, 2026, March 1st, unit 1
  SC-2026-0301-001  = Seed Cycle, 2026, March 1st, unit 1

SKU Codes:
  DP = Day Pack
  SO = Soak Overnight
  SC = Seed Cycle
  DB = Date Bytes
```

### Lifecycle of a SKU Instance

```
CREATED (production complete)
  → IN_STOCK (available for orders)
  → ALLOCATED (assigned to a sales order)
  → DISPATCHED (scanned at courier pickup)
  → DELIVERED (confirmed delivery)
```

### In Inventory View

```
Day Pack Weekly Stock: 20 units
  DP-2026-0301-001  IN_STOCK
  DP-2026-0301-002  IN_STOCK
  DP-2026-0301-003  ALLOCATED → SO-2026-00045
  ...
  DP-2026-0301-020  IN_STOCK
```

This gives complete traceability: "Which batch of almonds went into which Day Pack that was shipped to which customer."

---

## PART 5: NEW DATABASE TABLES (Complete)

### Table: `sales_orders`

```sql
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE,
  customer_id UUID REFERENCES customers(id),
  customer_name VARCHAR(255),

  -- Order Source & Details
  order_date DATE DEFAULT CURRENT_DATE,
  order_source VARCHAR(50),       -- whatsapp, website, instagram, meta_ad, walkin, zoho

  -- Items
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
  payment_method VARCHAR(50),     -- upi, cod, bank_transfer, gpay, phonepe
  payment_status VARCHAR(50) DEFAULT 'pending',
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  payment_date DATE,
  transaction_id VARCHAR(100),

  -- Status Pipeline
  status VARCHAR(50) DEFAULT 'packing',
  -- follow_up, awaiting_payment, packing, packed, dispatched, in_transit,
  -- delivered, completed, cancelled, returned, refunded

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

  -- QR
  qr_code_data TEXT,

  -- Linked Records
  invoice_id UUID,
  zoho_order_id VARCHAR(100),     -- For imported Zoho orders

  -- Feedback
  feedback_sent BOOLEAN DEFAULT FALSE,
  feedback_rating INTEGER,        -- 1-5 stars
  feedback_text TEXT,
  feedback_date DATE,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `purchase_orders`

```sql
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE,
  vendor_id UUID REFERENCES vendors(id),
  vendor_name VARCHAR(255),

  -- Items
  items JSONB DEFAULT '[]'::jsonb,
  -- [{ingredient_name, quantity_ordered, quantity_received, unit, price_per_unit, total, batch_number, expiry_date}]

  -- Financials
  subtotal DECIMAL(10,2) DEFAULT 0,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'ordered',
  -- draft, ordered, partially_received, received, billed, cancelled
  order_date DATE DEFAULT CURRENT_DATE,
  expected_date DATE,
  received_date DATE,

  -- Payment to Vendor
  payment_status VARCHAR(50) DEFAULT 'paid',
  amount_paid DECIMAL(10,2) DEFAULT 0,
  payment_method VARCHAR(50),
  payment_date DATE,

  -- Vendor Bill
  vendor_bill_number VARCHAR(100),
  vendor_bill_date DATE,
  vendor_bill_image_url TEXT,    -- Uploaded bill photo

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `production_runs`

```sql
CREATE TABLE IF NOT EXISTS production_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number VARCHAR(50) UNIQUE,
  run_date DATE DEFAULT CURRENT_DATE,

  -- Multiple SKUs in one run
  items JSONB DEFAULT '[]'::jsonb,
  -- [{sku_id, sku_name, sku_code, pack_type, planned_qty, actual_qty, wastage_qty, instance_numbers: [...]}]

  -- Raw Materials Consumed
  materials_consumed JSONB DEFAULT '[]'::jsonb,
  -- [{ingredient_id, ingredient_name, quantity_consumed, unit, cost, batch_ids: [...]}]

  -- Packaging Consumed
  packaging_consumed JSONB DEFAULT '[]'::jsonb,
  -- [{material_name, quantity_used, unit_cost, total_cost}]

  -- Cost Summary
  total_material_cost DECIMAL(10,2) DEFAULT 0,
  total_packaging_cost DECIMAL(10,2) DEFAULT 0,
  labour_cost DECIMAL(10,2) DEFAULT 0,
  other_cost DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'planned',
  -- planned, in_progress, completed, cancelled

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `packaging_materials`

```sql
CREATE TABLE IF NOT EXISTS packaging_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,           -- "Weekly Box (3-ply)", "Sachet Cover", "Tape Roll"
  category VARCHAR(100),                -- box, sachet, sticker, tape, wrapper, nitrogen, other
  dimensions VARCHAR(100),              -- "21.6 x 14.0 x 10.2 cm"
  unit VARCHAR(50),                     -- 'pieces', 'rolls', 'meters'
  cost_per_unit DECIMAL(10,2),          -- Rs.11 per box
  current_stock DECIMAL(10,2) DEFAULT 0,
  safety_stock_level DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `sku_instances` (Individual Unit Tracking)

```sql
CREATE TABLE IF NOT EXISTS sku_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_number VARCHAR(50) UNIQUE,     -- DP-2026-0301-001
  sku_id UUID REFERENCES skus(id),
  sku_name VARCHAR(255),
  pack_type VARCHAR(50),                  -- weekly, monthly
  production_run_id UUID REFERENCES production_runs(id),
  sales_order_id UUID,                    -- Linked when allocated to order
  status VARCHAR(50) DEFAULT 'in_stock',  -- in_stock, allocated, dispatched, delivered
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `expenses`

```sql
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE DEFAULT CURRENT_DATE,
  category VARCHAR(100),
  -- raw_materials, packaging, shipping, advertising, labour, rent, equipment, tax, miscellaneous
  description TEXT,
  amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  vendor_name VARCHAR(255),

  -- Reference
  reference_type VARCHAR(50),     -- purchase_order, sales_order, manual
  reference_id UUID,

  -- Receipt/Bill
  receipt_image_url TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `documents` (File Storage)

```sql
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(255),
  file_url TEXT,                           -- Supabase Storage URL
  file_type VARCHAR(50),                   -- image/jpeg, image/png, application/pdf
  file_size INTEGER,
  category VARCHAR(100),
  -- vendor_bill, courier_bill, tax_receipt, product_photo, other
  description TEXT,

  -- Linked to
  linked_type VARCHAR(50),                -- purchase_order, sales_order, expense, none
  linked_id UUID,

  tags JSONB DEFAULT '[]'::jsonb,         -- ["jagan_nuts", "almonds", "feb2026"]

  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `stock_movements` (Audit Trail)

```sql
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  item_type VARCHAR(50),        -- ingredient, finished_good, packaging
  item_id UUID,
  item_name VARCHAR(255),

  movement_type VARCHAR(50),
  -- purchase_in, production_consume, production_output, sales_out,
  -- adjustment, wastage, return_in, packaging_out
  direction VARCHAR(10),        -- 'in' or 'out'
  quantity DECIMAL(10,2),
  unit VARCHAR(50),

  -- Reference
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(50),

  -- Stock snapshot
  stock_before DECIMAL(10,2),
  stock_after DECIMAL(10,2),

  -- Cost
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sequences

```sql
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS production_number_seq START 1;
```

---

## PART 6: SIDEBAR NAVIGATION (Redesigned)

```
SIDEBAR (Zoho Inventory style with grouped sections)
=====================================================

🏠 Home                    /                   Dashboard

── SALES ──────────────────────────────────────
📋 Sales Orders            /orders              Order pipeline + dispatch
👥 Customers               /customers           Customer database
📄 Invoices                /invoices            Billing

── PURCHASE ───────────────────────────────────
🛒 Purchase Orders         /purchases           Raw material buying
🏪 Vendors                 /vendors             Vendor management

── INVENTORY ──────────────────────────────────
📦 Items (SKUs)            /skus                Product management
🥜 Ingredients             /ingredients         Raw material stock
📊 Finished Goods          /inventory           Product stock levels
🏷️ Packaging               /packaging           Boxes, sachets, tapes

── PRODUCTION ─────────────────────────────────
🏭 Production Runs         /production          Manufacturing
💰 Pricing & Costing       /pricing             Cost analysis

── BUSINESS ───────────────────────────────────
💳 Expenses                /expenses            All business expenses
📁 Documents               /documents           Bill/receipt storage
📈 Reports                 /reports             Analytics & reports
⚙️ Settings                /settings            Printer, company info, templates
```

---

## PART 7: IMPLEMENTATION PHASES

### Phase 1: SALES ORDERS + DISPATCH (Week 1-2)
**Eliminates daily pain immediately**

Build:
- sales_orders table + Supabase CRUD
- SalesOrders.jsx page (pipeline view with status tabs)
- New order form (customer, items, payment, source)
- Follow-up / lead tracking with reminders
- Packing list view ("Today's orders to pack")
- Address label generation (A4 format, 4x6 ready)
- QR code generation per order
- QR scanner (camera) for dispatch
- Bulk tracking number entry page
- WhatsApp message generator (copy + open WhatsApp link)
- Zoho CSV/Excel import
- Update sidebar navigation
- Link to existing Invoice + Customer + Inventory systems

NPM packages: qrcode.react, html5-qrcode

### Phase 2: PURCHASE ORDERS + BILL TRACKING (Week 3)
**Track raw material buying and vendor payments**

Build:
- purchase_orders table + CRUD
- PurchaseOrders.jsx page
- Receive goods → auto-create ingredient batches
- Bill upload + document storage (Supabase Storage)
- OCR integration (Google Cloud Vision free tier)
- Link to existing price_history system
- expenses table + basic expense tracking

### Phase 3: PRODUCTION + SKU NUMBERING (Week 4)
**Track manufacturing and unit-level inventory**

Build:
- production_runs table + CRUD
- sku_instances table
- ProductionRuns.jsx page
- Multi-SKU production run (20 DP + 5 SO + 20 SC)
- Auto-calculate raw materials from recipes
- FIFO consumption of ingredients
- SKU instance number generation
- Finished goods inventory update
- packaging_materials table + tracking

### Phase 4: PACKAGING INVENTORY + EXPENSES (Week 5)
**Track every packaging cost and business expense**

Build:
- Packaging.jsx page (packaging materials CRUD + stock)
- Auto-deduct packaging on dispatch
- Expenses.jsx page (all business expenses)
- Documents.jsx page (upload/browse bills & receipts)
- Expense categories + monthly summary

### Phase 5: REPORTS + ENHANCED DASHBOARD (Week 6)
**Analytics and insights**

Build:
- Reports.jsx with:
  - Sales report (daily/weekly/monthly, by SKU, by source)
  - Purchase report (by vendor, by ingredient, price trends)
  - Price history YoY comparison charts
  - Production report (units produced, wastage, cost per unit)
  - Profit/loss per order, per SKU, per month
  - Inventory turnover
  - Customer analytics (top customers, lifetime value)
  - Ad ROI (Meta ads spend vs revenue)
  - Packaging cost analysis
- Enhanced Dashboard with:
  - Today's pending actions (orders to pack, follow-ups due)
  - Low stock alerts (ingredients + finished goods + packaging)
  - Revenue this week/month
  - Recent orders + dispatches
- Settings page (company info, printer format, WhatsApp templates)

NPM packages: recharts (charts library)

---

## PART 8: KEY AUTOMATIONS

| When This Happens | System Automatically Does |
|---|---|
| Order created (payment received) | Generate invoice, show in packing list |
| Print Label clicked | Status → PACKED, label PDF generated |
| QR scanned at dispatch | Status → DISPATCHED, inventory deducted (finished goods + packaging) |
| Tracking numbers entered | Status → IN_TRANSIT, WhatsApp messages generated |
| Delivery confirmed | Status → DELIVERED, feedback message generated (after 1 day) |
| Purchase order received | Create ingredient batches, update stock, log price history |
| Production completed | Deduct raw materials (FIFO), deduct packaging, add finished goods with SKU numbers |
| Any stock changes | Log entry in stock_movements audit trail |
| Ingredient below safety level | Alert on dashboard |
| Packaging below safety level | Alert on dashboard |
| Ingredient batch nearing expiry | Orange/red highlight on dashboard |
| Price change detected on purchase | Log to price_history, calculate volatility score |
| Zoho CSV imported | Create orders with correct status mapping |
| Expense recorded | Categorized and totaled in monthly report |

---

## PART 9: TECHNOLOGY & LIBRARIES

### Existing Stack (no changes)
- React 18 + Vite
- Supabase (PostgreSQL + Storage for file uploads)
- Tailwind CSS
- React Router
- jsPDF (invoice PDF)
- lucide-react (icons)
- xlsx (Excel import/export)

### New Libraries Needed
- `qrcode.react` — Generate QR codes on labels
- `html5-qrcode` — Camera-based QR scanning for dispatch
- `recharts` — Charts for reports & analytics
- `@anthropic-ai/sdk` or Google Cloud Vision — OCR for bill scanning (Phase 2, optional)

### Supabase Storage (for file uploads)
- Bucket: `documents` — vendor bills, courier bills, receipts
- Bucket: `product-images` — product photos
- Free tier: 1GB storage, sufficient for bills/receipts

---

## PART 10: WHAT WE MIGHT HAVE MISSED (Checklist)

| Area | Covered? | Notes |
|---|---|---|
| Order lifecycle (WhatsApp to delivery) | ✅ | Full pipeline with QR scanning |
| Follow-up / Lead tracking | ✅ | With reminder dates |
| COD orders | ✅ | Payment after delivery |
| Website orders (Zoho import) | ✅ | CSV/Excel import |
| Payment tracking (UPI, COD, bank) | ✅ | With transaction ID |
| Address label printing (A4 + 4x6) | ✅ | Both formats |
| QR code scan for dispatch | ✅ | Camera-based |
| Tracking number bulk entry | ✅ | Option A + B |
| WhatsApp notification | ✅ | Semi-automated (copy + open) |
| Delivery tracking | ✅ | Manual + future auto |
| Customer feedback | ✅ | Rating + text |
| Raw material purchase tracking | ✅ | Full PO system |
| Vendor bill upload + OCR | ✅ | Phase 2 |
| Price history YoY comparison | ✅ | Already built + enhanced |
| Production tracking | ✅ | Multi-SKU runs |
| SKU instance numbers | ✅ | Per-unit tracking |
| Raw material consumption (FIFO) | ✅ | Already built |
| Finished goods inventory | ✅ | Auto-add/deduct |
| Packaging materials inventory | ✅ | Boxes, sachets, tapes |
| Packaging cost tracking | ✅ | Cost per unit |
| All business expenses | ✅ | Categorized |
| Document storage (bills, receipts) | ✅ | Supabase Storage |
| Delivery box sizes tracked | ✅ | Weekly 21.6x14x10.2, Monthly 26.7x20.3x21.6 |
| Monthly = 4x Weekly logic | ✅ | Auto-conversion |
| Stock movement audit trail | ✅ | Every gram tracked |
| Low stock alerts | ✅ | Dashboard alerts |
| Expiry tracking | ✅ | Already built |
| GST calculation | ✅ | Already built |
| Reports & analytics | ✅ | Comprehensive |
| Ad ROI tracking | ✅ | Meta ads spend vs revenue |
| Mobile friendly | ✅ | Tailwind responsive |
| Offline fallback | ✅ | Already built (localStorage) |

---

## SUMMARY

**Total new database tables: 7**
- sales_orders, purchase_orders, production_runs
- packaging_materials, sku_instances, expenses, documents
- stock_movements (audit trail)

**Total new pages: 7**
- Sales Orders, Purchase Orders, Production Runs
- Packaging, Expenses, Documents, Reports
- (+ Settings page)

**Enhanced existing pages: 4**
- Dashboard, Inventory, Ingredients, Invoices

**Timeline: ~6 weeks** (can overlap phases)

**This is the COMPLETE Business OS for WKLY Nuts.**
