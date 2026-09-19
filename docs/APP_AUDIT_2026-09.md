# WKLY Nuts App — Full Audit & Upgrade Plan
Date: 19 Sep 2026

## How this audit was done (and its limits)
- Scanned all ~39,500 lines of code automatically: which files are used, which database functions are ever called, which screens are reachable from the menu.
- Queried the live database (294 orders, 324 invoices, 267 customers, production, stock, expenses) and checked whether the numbers agree with each other.
- Read line by line the code that handles money and stock: invoices, GST, stock deduction, production, costing, login, saving.
- NOT read line by line: WhatsApp sender, Quick Order parser, Documents, Vendor Comparison, Pricing Strategy, Marketing. I only checked those for use and overlap.

---
## 1. Verdict
**Do not rebuild.** The parts you use every day are sound: orders, customers, CRM, label printing, tracking and the GST register. What is broken is the connections between them. Orders, invoices, stock, production and costs are not tied together, so each screen shows its own version of the truth. The fix is to restructure in place, not to start over.

---
## 2. Critical problems (ranked)

### C1. The database is open to anyone (security)
- Every table's access rule is "allow all" for the public key that sits inside the website code. The login (username/password) only hides the screens in the browser; the password itself is also inside the downloadable website code.
- Anyone who finds the key can read, change or delete all 267 customers' phone numbers and addresses, and all orders and invoices.
- Fix: real login through Supabase, and database rules that allow only logged-in users.

### C2. Orders and invoices are not linked
- 189 real orders have no invoice. 232 of the 324 invoices belong to no order.
- 57 duplicate invoices exist from a bug (fixed for the future, not cleaned up). Two promotion orders got invoices. There were two competing numbering styles.
- Invoice PDF and GST Export add GST on top of the price; the order form includes it. Same sale, different numbers.
- Result: GST cannot be produced reliably from the app. It had to be rebuilt by hand for August.

### C3. Order status does not match reality
- 52 orders sit at "Confirmed" (48 older than 7 days, oldest from 3 June, ₹34,669). 43 sit at "Dispatched" (all older than 7 days, oldest from 7 March, ₹39,149).
- Most are almost certainly delivered. So "To Be Packed" and "To Be Delivered" on the dashboard, and the new red "Stuck" flag, are unreliable until this is cleaned.
- Root cause: nothing moves orders forward automatically after dispatch (the ST Courier check was removed).

### C4. Finished-goods stock froze on 26 July
- Stock is reduced in five different places: on dispatch, on QR scan, and three separate spots when an invoice is marked paid. Your current daily flow (print label, scan slip) triggers none of them.
- No sale has reduced stock since July. Day Pack still shows 89 boxes. Seed Cycle, your best seller, has no stock record at all.
- The invoice path and the order path count monthly packs differently (1 vs 4 boxes), and both can fire on the same order, so stock can also be deducted twice.
- The stock screen (`/inventory`) has no menu link, so nobody sees this.

### C5. Production calculator is broken in three ways
1. **Completing a run adds nothing.** The confirm dialog shows the planned quantity, but the code that adds stock reads the recorded quantity, which is 0. All 4 "completed" runs show 0 produced and added 0 boxes to stock.
2. **Ingredient names do not match.** Recipes say "Almonds"; stock says "Almonds Regular" / "Almonds Premium". The mapping table (`ingredient_aliases`) is empty, and the production screen only accepts exact names. So cost shows ₹0 and raw materials are not deducted ("not found in stock"). 11 of 15 runs have ₹0 cost.
3. **Costing method mixes two systems.** Stock is deducted oldest-batch-first, but cost uses the average price of whatever is left, so a run's cost changes after the fact.
- Also: 8 runs sit at "planned" since June, 1 at "quality check" since March. Almonds Regular shows 202.6 kg, which looks like a data-entry error. Labour can be entered both in a run and in the Work Log (double-count risk).

### C6. Profit cannot be calculated
- Only 3 expenses are recorded (₹6,455, all 18–20 Aug), against ₹45,615 of purchases. There is nothing for courier cost, rent, staff, marketing, Amazon/HungerBox commission, TCS/TDS, or platform fees.
- Courier slip amounts contain typos (₹1,280, ₹5,310, ₹403, ₹1.28).
- Channel fee % is saved only inside one browser, not in the database.

### C7. Amazon and HungerBox are not in the app
- Amazon exists only as loose invoices; no Amazon orders in the app for August. HungerBox was removed. The dashboard understates August by about ₹10,900.
- Commission, GST on commission, TCS and TDS are not captured per sale. No credit-note use (the `credit_notes` table is empty), though Amazon refunds happen.

---
## 3. Medium problems
- 20 order lines are not linked to any SKU (e.g. "fig", "Date bites"), so they get no stock, cost or HSN.
- 17 customers have no phone; 35 have no state (needed for GST place of supply). 3 orders show "paid" with a different amount paid. 8 orders have ₹0 total.
- The app has two modes: cloud and a copy saved in the browser. If the cloud is unreachable it silently works on local data that never syncs.
- Several settings live only in one browser (channel fees, WhatsApp templates).
- Overlapping screens: Reports, Sales Target, Omni Channels, Marketing and Channel Performance all compute profit differently. Three "inventory" screens (raw, packaging, finished goods).

---
## 4. Unused / dead / cluttered
**Files never used (about 2,090 lines):** DataManagement (659), RecipeMaker page (549, not routed), QRLabelPrint (253), ProductionSimulator (189), ProfitLossWidget (105), TopItems (96), RecentActivity (80), DashboardStats (79), LapsedCustomers (74), DashboardTabs (59). Plus 4 database functions never called.

**Screens that exist but have no menu link:** Finished-goods Inventory, GST & Tax Filing (the menu item "GST Filing" opens Invoices instead), Sales Target & Revenue, Pricing Strategy, Vendor Management, Vendor Comparison, Documents, Help Guide.

**Database tables with 0 rows (never used):** vendors, pricing_strategies, sales_targets, price_history, documents, packaging_transactions, marketing_contacts, marketing_campaigns, production_wastage, channel_expenses, credit_notes, ingredient_aliases.

**Housekeeping:** 31 old notes/plan files and stray text files in the project root, 90 debug messages left in code, one 2.9 MB download for every page (slow on a phone), and three files far too large to maintain safely (database service 4,182 lines, SKU screen 3,105, Invoice screen 2,603).

---
## 5. How the app should work (target design)
One chain, each step feeding the next, one place for each fact:

1. **Sale** (any channel: WhatsApp, Website, Instagram, Amazon, HungerBox) becomes one order. Price is final, GST included.
2. **Invoice** is created once, automatically, when the order is confirmed and paid. It is numbered by one counter only. Promotion orders never get one. Refunds create a credit note.
3. **Stock** is reduced once, at one moment (when the order is dispatched), by one rule (monthly = 4 boxes). It is added once, when a production run is completed.
4. **Production run** completes with the real quantity, deducts the ingredients actually used (oldest first), packaging and labour, and records the true cost per box.
5. **Delivery** status updates itself (ST Courier check) or is confirmed in one tap. Anything not moving for N business days turns red.
6. **Money** in: customer payments, and Amazon/HungerBox payouts booked against each sale after commission, TCS and TDS. Money out: purchases, courier cost, labour, marketing, fees.
7. **Reports**, all from that one data: monthly GST register (exact format your auditor uses, in one click), profit and loss, profit by channel and by product, cash position, stock and reorder alerts.

---
## 6. Recommended upgrade plan

| Phase | What | Effort |
|---|---|---|
| **0. Now (before filing)** | Safety backup of the database. | 0.5 day |
| **1. Lock the doors** | Real login; database rules so only you and your wife can read or write. | 1–2 days |
| **2. One money rule** | GST included everywhere (invoice PDF, GST Export, GST page). One invoice-number source. No promotion invoices. Remove duplicates and orphans (with backup). Link every order to exactly one invoice. | 2–3 days |
| **3. Truthful status and stock** | Clean the old Confirmed/Dispatched orders once. Automatic delivery updates again. One stock rule, one place. Rebuild finished-goods stock from real production and sales. | 3–4 days |
| **4. Fix production** | Ingredient name mapping, completing a run saves the real quantity and adds stock, costing from the batches actually used, close old planned runs. | 3–4 days |
| **5. Channels and costs** | Add Amazon and HungerBox with commission/TCS/TDS per sale, credit notes, an expense form that is fast to use (courier, rent, staff, ads), fee settings saved in the database. | 4–5 days |
| **6. Reports and tidy-up** | One Reports screen (GST, P&L, channel, product). Delete dead files/tables and old notes, merge overlapping screens, split the giant files, faster loading. | 3–4 days |

Rules for every phase: one change at a time, checked against real data, backup before anything is deleted.

## 7. Decisions needed from you
1. Approve starting with Phase 1 and 2 right after the GST filing.
2. Who else needs to log in (just you and your wife)?
3. Should courier cost be entered per order (yes/no)? It drives real profit per order.
4. Confirm you no longer use: Vendor Comparison, Pricing Strategy, Sales Target, Recipe Maker. I will remove or hide them.
