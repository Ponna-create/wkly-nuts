# 📊 Competitor Analysis & Improvement Roadmap

**Subject**: WKLY Nuts Production Tool vs. Market Leaders (Zoho Inventory, Odoo, QuickBooks Commerce)
**Date**: 2026-01-24

---

## 1. Executive Summary

Your application, **WKLY Nuts**, is currently a specialized **Production Planning & Costing Tool**.
*   **Superpower**: It excels at *Recipe Costing* and *Sachet-to-Box Calculations* (Weekly/Monthly packs). Generic tools often struggle with this specific "Gram-per-sachet" manufacturing logic without expensive add-ons.
*   **Gap**: It lacks standard **ERP (Enterprise Resource Planning)** features like formal Purchase Orders to replenish stock, Batch Tracking for food safety, and Financial Integrations.

Below is a detailed comparison to **Zoho Inventory**, the closest market competitor for SMBs.

---

## 2. Feature Comparison Matrix

| Feature Category | 🟢 WKLY Nuts (Your App) | 🔵 Zoho Inventory / Standard ERPs | 💡 The Gap / Opportunity |
| :--- | :--- | :--- | :--- |
| **Product Logic** | **Excellent.** Custom "Sachet" & "Pack" logic built-in. | **Generic.** "Composite Items" exist but require manual unit conversion setup. | You win here on usability for *your specific workflow*. |
| **Inventory Tracking** | **Basic.** Simple stock counters. | **Advanced.** Committed vs. Available, Reorder Points, Warehouses. | **Improvement:** Add "Committed Stock" (orders placed but not shipped). |
| **Food Safety** | 🔴 **None.** | 🟢 **Batch/Lot Tracking & Expiry Dates.** | **CRITICAL for Food.** You need to know which batch of almonds went into which pack in case of recalls. |
| **Procurement** | 🟡 **Partial.** Calculates needs ("Ingredients Order List"). | 🟢 **Full Cycle.** PO Creation → Email Vendor → Receive Goods → Update Stock. | **Improvement:** Convert your "Order List" into actual Purchase Order records. |
| **Sales & Invoices** | 🟢 **Good.** Generates PDFs, calculates GST. | 🟢 **Advanced.** Payment Gateway links, recurring invoices, client portal. | **Improvement:** Add "Pay Now" links (Razorpay/Stripe) to your PDFs. |
| **Shipping** | 🔴 **Manual.** Type raw cost. | 🟢 **Integrated.** Fetch live rates from FedEx/DHL/Shiprocket. | **Improvement:** Low priority for now, but integration saves time later. |
| **Accounting** | 🔴 **None.** | 🟢 **Integrated.** Syncs with Zoho Books/QuickBooks. | **Improvement:** Export Sales Report in a format ready for Tally/QuickBooks. |

---

## 3. High-Impact Improvements (Ranked)

Based on the comparison, here are the top 3 areas to improve to reach "Pro" level:

### 🥇 Priority 1: Food Safety & Batch Tracking (Critical)
**The Problem**: Currently, you just say you have "100kg Almonds". In reality, you have "50kg from Batch A (Expiring Jan)" and "50kg from Batch B (Expiring Dec)".
**The Fix**:
1.  **Modify Inventory**: Split stock by `Batch Number` and `Expiry Date`.
2.  **FIFO Logic**: When producing packs, automatically suggest using the oldest ingredients first (First-In, First-Out).
3.  **Traceability**: Record which ingredient batch was used for which Invoice/Production run.

### 🥈 Priority 2: Formal Purchase Order (PO) Lifecycle
**The Problem**: You currently calculate *what* you need, but you don't track the *ordering process*.
**The Fix**:
1.  **Create PO Module**: Convert the "Shortage List" into a Database Record (Purchase Order).
2.  **Status Workflow**: `Draft` → `Sent` → `Partial Received` → `Closed`.
3.  **Auto-Stock**: When you mark a PO as "Received", it should automatically increase your Component Inventory.

### 🥉 Priority 3: Financial Integrity & Payments
**The Problem**: An invoice is just a PDF. Tracking who paid what is manual.
**The Fix**:
1.  **Payment Records**: Allow partial payments against invoices (e.g., "Advance Received", "Final Payment").
2.  **Aging Report**: Show a dashboard of "Who owes me money and for how long?".
3.  **Payment Links**: Embed a QR Code or Check link in the Invoice PDF.

---

## 4. Proposed Implementation Roadmap

We can tackle these improvements in phases:

### Phase 1: The "Storekeeper" Update (Inventory Depth)
*   [ ] Add `expiry_date` and `batch_number` to Ingredient Inventory.
*   [ ] Implement **Stock Log** (Activity History): Record *who* changed stock and *why* (Sale, Spoilage, Purchase).
*   [ ] Low Stock Alerts (Visual indicators or Email notifications).

### Phase 2: The "Purchasing Manager" Update (Procurement)
*   [ ] Build **Purchase Order (PO)** System.
*   [ ] Connect POs to Vendors and Inventory (auto-increment stock on receive).

### Phase 3: The "Accountant" Update (Money)
*   [ ] Payment Recording (Partial payments).
*   [ ] "Accounts Receivable" Dashboard.
*   [ ] Expense Tracking (track non-COGS expenses like Rent/Electricity to get true Net Profit).

---

## Recommendation
**Start with Phase 1 (Batch Tracking & Stock Logs).**
As a food business, this is your biggest operational risk. Zoho handles this out of the box, so your custom tool needs to match that safety standard.
