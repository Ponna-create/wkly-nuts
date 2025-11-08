# 📋 Complete Plan: Inventory + Invoice Management System

## 🎯 Your Vision

**3 Main Tabs:**
1. ✅ **Customer Management** (DONE)
2. 🆕 **Inventory/Stocks Management** (NEW - to be built)
3. 🆕 **Invoice Management** (NEW - to be built)

---

## 🔄 Complete Flow

### Step 1: Add Customer ✅
- Go to **Customer Management**
- Add customer details (name, phone, address, GSTIN, etc.)
- Customer is saved

### Step 2: Manage Inventory 🆕
- Go to **Inventory/Stocks Management**
- See all SKUs (products) you have
- Manually enter/update stock levels:
  - **Weekly Packs Available**: e.g., 50 packs
  - **Monthly Packs Available**: e.g., 20 packs
- Track current stock for each SKU
- View stock history (optional)

### Step 3: Create Invoice 🆕
- Go to **Invoice Management**
- Click "Create New Invoice"
- **Select Customer** (from Customer Management)
- **Add Items**:
  - Select SKU (e.g., "Almond Mix")
  - Select Pack Type (Weekly or Monthly)
  - Enter Quantity (e.g., 5 packs)
  - **System automatically**:
    - ✅ Checks if stock is available
    - ✅ Shows warning if stock is low/out
    - ✅ Gets price from Pricing Strategy
    - ✅ Calculates total
- Add tax, discount if needed
- Generate invoice
- **When invoice is created/paid**:
  - ✅ Automatically reduce stock from inventory
  - ✅ Update inventory levels

---

## 📊 Database Schema Changes Needed

### New Table: `inventory` (or `stock`)

```sql
CREATE TABLE inventory (
  id UUID PRIMARY KEY,
  sku_id UUID REFERENCES skus(id),
  weekly_packs_available NUMERIC(10, 2) DEFAULT 0,
  monthly_packs_available NUMERIC(10, 2) DEFAULT 0,
  last_updated TIMESTAMP,
  notes TEXT
);
```

**What it stores:**
- Which SKU
- How many weekly packs in stock
- How many monthly packs in stock
- Last update time
- Optional notes

---

## 🏗️ What Needs to Be Built

### Phase 1: Inventory Management (Build First) 🆕

**New Page: `InventoryManagement.jsx`**

**Features:**
1. **Stock Overview Table**
   - List all SKUs
   - Show current stock (weekly + monthly packs)
   - Color coding:
     - 🟢 Green: Good stock (>10 packs)
     - 🟡 Yellow: Low stock (5-10 packs)
     - 🔴 Red: Out of stock (<5 packs)

2. **Manual Stock Entry**
   - Select SKU
   - Enter weekly packs available
   - Enter monthly packs available
   - Add notes (optional)
   - Save

3. **Stock Updates**
   - Edit existing stock levels
   - Add/Subtract stock (with reason)
   - View stock history (optional)

4. **Stock Alerts**
   - Show low stock warnings
   - Highlight out of stock items

**Database:**
- Create `inventory` table
- Add CRUD functions to Supabase service
- Add to AppContext

---

### Phase 2: Invoice Management (Build After Inventory) 🆕

**New Page: `InvoiceManagement.jsx`**

**Features:**
1. **Invoice List**
   - Show all invoices
   - Filter by status (draft, sent, paid, overdue)
   - Search by customer name or invoice number
   - Sort by date, amount

2. **Create Invoice Form**
   - **Step 1: Select Customer**
     - Dropdown from Customer Management
     - Show customer details
   
   - **Step 2: Add Items**
     - Select SKU (from your SKUs)
     - Select Pack Type (Weekly/Monthly)
     - Enter Quantity
     - **Stock Check**:
       - ✅ Show available stock
       - ⚠️ Warn if insufficient stock
       - ❌ Block if out of stock
     - **Auto-Price**:
       - Get price from Pricing Strategy
       - Calculate line total
     - Add/Remove items
   
   - **Step 3: Calculate Totals**
     - Subtotal (sum of all items)
     - Tax (GST) - percentage
     - Discount - fixed amount
     - Total Amount
   
   - **Step 4: Additional Info**
     - Invoice date (auto: today)
     - Due date
     - Payment terms
     - Notes
   
   - **Step 5: Generate**
     - Auto-generate invoice number (INV-2025-00001)
     - Save as "draft" or "sent"
     - **Reduce stock** from inventory

3. **Invoice Actions**
   - View invoice details
   - Edit invoice (if draft)
   - Mark as "Sent"
   - Mark as "Paid" (reduces stock if not already reduced)
   - Delete invoice (restore stock if needed)
   - Print/Download PDF

4. **Stock Integration**
   - When invoice created → reduce stock
   - When invoice paid → ensure stock reduced
   - When invoice deleted → restore stock (optional)

---

## 🔗 How Everything Connects

```
┌─────────────────┐
│   Customers     │ ← Add customer details
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Inventory     │ ← Track SKU stock levels
│   Management    │   (Weekly & Monthly packs)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Invoice       │ ← Create invoice
│   Management    │   1. Select customer
└────────┬────────┘   2. Add SKU items
         │            3. Check stock availability
         │            4. Get prices from Pricing Strategy
         │            5. Generate invoice
         │            6. Reduce stock
         ▼
┌─────────────────┐
│   Pricing       │ ← Get selling prices
│   Strategy      │   (Already exists)
└─────────────────┘
```

---

## 📝 Implementation Order

### ✅ Step 1: Customer Management (DONE)
- Already completed

### 🆕 Step 2: Inventory Management (BUILD FIRST)
**Why first?** Because invoices need to check stock availability

**What to build:**
1. Database table: `inventory`
2. Supabase service functions
3. AppContext state management
4. Inventory Management page
5. Navigation link

**Time:** ~2-3 hours

### 🆕 Step 3: Invoice Management (BUILD SECOND)
**Why second?** Because it depends on inventory

**What to build:**
1. Invoice Management page
2. Stock checking logic
3. Price integration with Pricing Strategy
4. PDF generation
5. Stock reduction on invoice creation/payment

**Time:** ~4-5 hours

---

## 🎨 UI Layout

### Navigation Menu (Sidebar):
1. Dashboard
2. Vendor Management
3. SKU Management
4. Pricing Strategy
5. Sales & Revenue
6. Vendor Comparison
7. **Customer Management** ✅
8. **Inventory Management** 🆕
9. **Invoice Management** 🆕

---

## 💡 Key Features

### Inventory Management:
- ✅ Manual stock entry
- ✅ Stock level tracking
- ✅ Low stock alerts
- ✅ Stock history (optional)

### Invoice Management:
- ✅ Customer selection
- ✅ SKU selection with stock check
- ✅ Automatic price from Pricing Strategy
- ✅ Stock reduction on invoice creation
- ✅ Invoice status tracking (draft, sent, paid)
- ✅ PDF generation
- ✅ GST calculation

---

## ❓ Questions for You

1. **Stock Reduction Timing:**
   - When should stock be reduced?
     - Option A: When invoice is **created** (recommended)
     - Option B: When invoice is **paid**
     - Option C: Manual (you decide when)

2. **Stock Restoration:**
   - If invoice is deleted/cancelled, should stock be restored?
     - Yes / No

3. **Stock Alerts:**
   - What's your "low stock" threshold?
     - e.g., Alert when < 10 packs?

4. **Invoice Status:**
   - Do you need these statuses?
     - Draft (not sent yet)
     - Sent (sent to customer)
     - Paid (payment received)
     - Overdue (past due date)
     - Cancelled

---

## ✅ Confirmation Needed

Please confirm:
1. ✅ This flow makes sense?
2. ✅ Build Inventory Management first?
3. ✅ Then Invoice Management?
4. ✅ Stock reduces when invoice is created (or paid)?
5. ✅ Any changes to the plan?

Once you confirm, I'll start building! 🚀

