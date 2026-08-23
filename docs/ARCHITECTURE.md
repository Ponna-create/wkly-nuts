# WKLY Nuts — Business OS: Full Architecture & Recreation Reference

> **Purpose of this document**: This is a from-scratch recreation reference for the WKLY Nuts internal business management app. It is written so that another LLM (or a future session with no memory of this one) can rebuild the app, understand *why* things work the way they do, and avoid re-introducing bugs that were already found and fixed. It documents not just the code structure but the business rules and hard-won decisions behind it — those are the parts that are easy to silently regress.
>
> Last verified against the live codebase: **2026-08-23**.

---

## 1. What This App Is

WKLY Nuts is a D2C/FMCG nuts & healthy-snacks business (Chennai, Tamil Nadu, India). This is their **internal single-tenant business operating system** — not a SaaS product with multiple customers. One business, two real users (owner + spouse who does most day-to-day order entry), password-gated, no user roles/permissions system.

It replaces what would otherwise be a tangle of WhatsApp chats + Excel sheets for: taking orders, tracking inventory raw-material-to-finished-goods, running production batches, pricing, invoicing/GST compliance, purchasing from vendors, and basic reporting.

**Core flows the business actually depends on day-to-day** (everything else is secondary/half-built — see §9):
1. **Orders** — mostly via Quick Order, a fast paste-to-order mobile flow
2. **Customers** — dedup, retention tracking
3. **Inventory** — raw ingredients (FIFO batches) → production → finished goods stock
4. **Production** — batch runs, costing
5. **Purchasing** — vendor POs that stock inventory on receipt

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | React 18 (function components + hooks only, no class components except `ErrorBoundary`) |
| Routing | `react-router-dom` v6, `BrowserRouter` |
| Build tool | Vite 7 |
| Styling | Tailwind CSS (utility classes inline, no CSS modules/styled-components) |
| Icons | `lucide-react` |
| Charts | `recharts` |
| State management | React Context + `useReducer` (no Redux/Zustand) — see §4 |
| Backend | **Supabase** (Postgres + RLS + auto-generated REST via `supabase-js`) — no custom backend server for CRUD |
| Serverless functions | 2 Vercel API routes (`/api/scan-slip`, `/api/settings`) for things that need a server (LLM API keys, a KV store) |
| KV store | Upstash Redis (via `@upstash/redis`), used only by `/api/settings` for WhatsApp template storage |
| PDF generation | `jspdf` + `jspdf-autotable` (invoices, purchase orders, A4 label sheets) |
| PDF *reading* | `pdfjs-dist` (parsing uploaded Amazon invoice PDFs to auto-fill order data) |
| QR codes | `qrcode.react` (generate), `html5-qrcode` (scan, camera-based) |
| Spreadsheet import/export | `xlsx` |
| Auth | Custom — single shared username/password from env vars, session token in `sessionStorage`, 24h expiry (see §5) |
| Hosting | Vercel |
| Local fallback | Full `localStorage`-backed mock mode when Supabase is unreachable/unconfigured (see §4.3) |

No TypeScript. No test suite. No CI. This is a fast-moving internal tool, not a product with external users — velocity over process has been the deliberate tradeoff throughout.

---

## 3. Repository Layout

```
src/
  App.jsx                 — route table (one <Route> per page, each wrapped in <ErrorBoundary>)
  main.jsx                — ReactDOM root
  context/
    AppContext.jsx         — global state: useReducer + Supabase sync wrapper (see §4)
  components/
    Auth.jsx                — login gate (see §5)
    Layout.jsx               — sidebar nav + header + test-mode toggle
    Toast.jsx                — global toast notifications (via AppContext SHOW_TOAST/HIDE_TOAST)
    ErrorBoundary.jsx        — class component, catches render crashes per-route
    DataManagement.jsx       — bulk import/export/backup UI
    DashboardStats.jsx, DashboardTabs.jsx, RecentActivity.jsx, TopItems.jsx,
    StockAlerts.jsx, LapsedCustomers.jsx, ProfitLossWidget.jsx  — Dashboard widgets
    COGSCalculator.jsx       — standalone cost-of-goods calculator
    ProductionSimulator.jsx  — "what-if" production planning tool (half-built, see §9)
    BillCSVImport.jsx        — bank/CC statement CSV → expense import with AI categorization
    common/DateRangePicker.jsx
    sales/                   — everything related to a single sales order's lifecycle
      NewOrderForm.jsx, OrderDetailView.jsx, DeleteOrderPanel.jsx
      LabelPrinter.jsx, BulkLabelPrint.jsx, A4LabelSheet.jsx, QRLabelPrint.jsx
      WhatsAppSender.jsx, BulkWhatsAppSend.jsx
      TrackingScanner.jsx, TrackingCSVImport.jsx, TrackingChecker.jsx, BulkTrackingEntry.jsx
      CourierDashboard.jsx, QRScanner.jsx, ZohoImport.jsx
  pages/                   — one file per route, see §7 for full inventory
  services/
    supabase.js              — dbService: THE single data-access layer (~4000 lines, see §6)
    mockDbService.js          — parallel implementation over localStorage (test mode)
    mockData.js               — seed data for test mode
  utils/
    settings.js               — localStorage app settings + business info cloud-sync
    skuCost.js                 — shared per-unit COGS calculation (see §8.3)
    invoiceFromOrder.js        — maps a sales order → invoice payload shape; isPromotionalOrder()
    orderPasteParser.js        — parses a pasted WhatsApp/Instagram order message
    addressParser.js           — extracts city/state/pincode from free-text address
    a4LabelSheet.js             — jsPDF label sheet generation
    amazonInvoicePdf.js         — parses uploaded Amazon invoice PDFs
    purchaseOrderPdf.js         — generates PO PDFs
    ocrMatch.js                  — matches an AI-read courier slip name/phone back to an order
    dateFormat.js, sanitize.js
api/
  scan-slip.js              — server-side multimodal LLM call (Gemini → Groq fallback chain) for courier slip OCR
  settings.js                — Upstash Redis-backed KV endpoint for WhatsApp templates etc.
docs/
  ARCHITECTURE.md           — this file
```

---

## 4. State Management & Data Flow

### 4.1 The pattern

`AppContext.jsx` is the single source of truth for almost all app data. It is **not** a thin wrapper — the reducer's `dispatch` is intercepted so that most actions do two things:
1. Update local React state immediately (optimistic UI)
2. Fire-and-continue an async call into `dbService` (Supabase) to persist it

```
Component → dispatch({ type: 'ADD_SALES_ORDER', payload }) → AppContext reducer updates state
                                                             → AppContext's dispatch wrapper also calls dbService.createSalesOrder(...)
```

Some flows bypass the reducer entirely and call `dbService` directly from the page/component (e.g. Quick Order's `createSalesOrder`), then manually dispatch a `LOAD_*`/`ADD_*` action with the *real* returned row (with its DB-generated id) to reconcile state. This dual pattern exists because the reducer-intercept approach doesn't handle "I need the created row's real ID back before I can do the next step" well — so newer, more complex flows (Quick Order, Order Detail) call `dbService` directly and dispatch the result themselves.

**When touching data flows, prefer the explicit `await dbService.xxx()` then `dispatch(...)` pattern** — it's more predictable and is what all new work in this app has moved toward.

### 4.2 Initial load

On mount, `AppProvider`'s `loadData()` (a `useCallback`, exposed as `refreshData` in context) does one big `Promise.all` fetching every table via `dbService.get*()` and dispatches a single `LOAD_ALL_DATA`. **This only runs once on mount** (plus whenever manually triggered) — it does *not* poll or subscribe to realtime changes. This means:

> ⚠️ **Known staleness gotcha**: if data changes on another device/browser tab (e.g. the spouse adds orders on her phone while the owner has the Dashboard open on desktop), the open tab's numbers go stale until it's refreshed. The Dashboard surfaces this explicitly with a "Refreshed X ago" indicator + manual Refresh button (see `Dashboard.jsx`) that calls `refreshData()` from context. Individual pages like `Reports.jsx` sidestep this by doing their **own** fresh `dbService.getSalesOrders()` fetch every time they mount, rather than reading from global `state`.

Context also exposes: `state`, `dispatch`, `showToast`, `isLoading`, `useDatabase` (bool — cloud vs local mode), `connectionError`, `lastSyncedAt`, `refreshData`.

### 4.3 Cloud vs local-only mode (`useDatabase`)

Controlled by `getDbMode()` in `settings.js` (`'auto' | 'cloud' | 'local'`, stored in localStorage):
- `local`: always use `mockDbService`/localStorage, ignore Supabase entirely
- `cloud`: force Supabase, surface a connection error banner if unreachable (common for India without VPN — Supabase's default region can be flaky there)
- `auto` (default): try Supabase, silently fall back to localStorage cache if it fails

There is also a separate **Test Mode** toggle in the header (`isTestMode()`/`setTestMode()`/`resetTestData()` in `supabase.js`) — orthogonal to the above, used to safely try things against seeded mock data without touching real business data. Shows a persistent amber "TEST MODE" banner when active.

### 4.4 Reducer action types (in `AppContext.jsx`)

Standard `LOAD_X` / `ADD_X` / `UPDATE_X` / `DELETE_X` per entity for: `SALES_ORDERS`, `VENDORS`, `SKUS`, `PRICING`, `SALES_TARGETS`, `CUSTOMERS` (plus `REPLACE_CUSTOMER` for the temp-id → real-id swap on customer creation), `INVOICES`, `INVENTORY`, `INGREDIENTS` (`UPDATE_INGREDIENT` only, loaded via `LOAD_INGREDIENTS`), `EXPENSES`, `PURCHASE_ORDERS`, `DOCUMENTS`, `PRODUCTION_RUNS`, plus `LOAD_MARKETING_CONTACTS`, `LOAD_MARKETING_CAMPAIGNS`, `SHOW_TOAST`/`HIDE_TOAST`, and `LOAD_ALL_DATA` (bulk initial load).

---

## 5. Authentication

Deliberately minimal — **not** Supabase Auth, **not** per-user accounts. See `components/Auth.jsx`:

- Single shared username (`VITE_APP_USERNAME`, default `admin`) + password (`VITE_APP_PASSWORD`) from env vars, checked client-side with a constant-time-ish string comparison.
- On success, generates a random 32-byte hex session token, stores `{ token, expiresAt, createdAt }` in `sessionStorage` (not `localStorage` — cleared when the browser tab/window closes), 24-hour expiry.
- `<Auth>` wraps the entire `<App>` — nothing renders until authenticated.
- No password reset flow, no per-user audit trail. This is intentional: it's a two-person internal tool, not a multi-tenant product.
- Supabase Row Level Security (RLS) is enabled on every table but with permissive "allow all" policies (`USING (true) WITH CHECK (true)`) — RLS is on for hygiene, not for actually restricting who can do what. Real access control is the app password wall.

---

## 6. `dbService` — the Data Access Layer

`src/services/supabase.js` (~4000 lines) exports a single `dbService` object with one method per operation, following a strict convention:

- `get*()` → `{ data, error }`
- `create*(payload)` → `{ data, error }`
- `update*(payload)` → `{ data, error }` (payload must include `id`)
- `delete*(id)` → `{ data, error }`

**camelCase ↔ snake_case convention**: JS/React code uses camelCase everywhere (`customerName`, `totalAmount`). Postgres columns are snake_case (`customer_name`, `total_amount`). Every `create*`/`update*` function does this mapping explicitly at the boundary. `updateSalesOrder` in particular uses a `pick(camel, snake)` helper and a big `fields` array of `[dbColumn, camelKey, snakeKey]` triples so **callers can pass either** — this was a deliberate resilience choice after bugs from call sites passing snake_case by accident. **When adding a new order field, add it to this `fields` array in `updateSalesOrder`, and the equivalent explicit key in `createSalesOrder`'s insert object** — nothing is automatic/reflective.

**`isSupabaseAvailable()`** gates every function — if Supabase env vars aren't configured, functions return `{ data: null/[], error }` gracefully rather than throwing.

**The `dbService` object itself has a `get(target, prop)` Proxy trap at the very end of the file** — used by test mode to transparently redirect every call to `mockDbService` instead when `isTestMode()` is true, without every call site needing to branch.

### 6.1 Full function inventory (grouped by domain)

| Domain | Functions |
|---|---|
| Vendors | `getVendors`, `createVendor`, `updateVendor`, `deleteVendor`, `getPriceHistory`, `getPriceVolatility` |
| SKUs | `getSKUs`, `createSKU`, `updateSKU`, `deleteSKU` |
| App settings | `getAppSetting`, `setAppSetting` (generic key/value, used for `businessInfo` cross-device sync) |
| Staff | `getStaff`, `createStaff`, `updateStaff`, `deleteStaff` |
| Work log | `getWorkLog`, `createWorkLogEntry`, `deleteWorkLogEntry` |
| Pricing strategies | `getPricingStrategies`, `createPricingStrategy`, `updatePricingStrategy`, `deletePricingStrategy` |
| Sales targets | `getSalesTargets`, `createSalesTarget`, `updateSalesTarget`, `deleteSalesTarget` |
| Customers | `getCustomers`, `getLapsedCustomers`, `createCustomer`, `findOrCreateCustomer`, `updateCustomer`, `deleteCustomer`, `findCustomerByPhone` |
| Invoices | `getInvoices`, `getNextInvoiceNumber`, `createInvoice`, `updateInvoice`, `deleteInvoice` |
| Credit notes | `getNextCreditNoteNumber`, `createCreditNote`, `getCreditNotes`, `getCreditNotesForOrder` |
| Inventory (finished goods) | `getInventory`, `getInventoryBySkuId`, `createInventory`, `updateInventory`, `updateInventoryStock`, `setFinishedGoodsStock`, `deleteInventory`, `logInventoryTransaction`, `getInventoryTransactions` |
| Ingredients (raw materials, FIFO) | `getIngredients`, `getIngredientBatches`, `addIngredientBatch`, `updateBatchExpiry`, `recordBatchWaste`, `updateBatchStatus`, `recalculateIngredientStock`, `consumeIngredientFIFO`, `getIngredientsForProduction` |
| Sales orders | `getSalesOrders`, `getSalesOrderById`, `createSalesOrder`, `updateSalesOrder`, `deleteSalesOrder`, `getSalesOrdersByStatus`, `getSalesOrdersByDate`, `deductInventoryForOrder`, `restockInventoryForOrder`, `findOrderByZohoId` |
| Reorder nudges (CRM) | `getReorderNudges`, `markReorderNudgeSent` |
| Expenses | `getExpenses`, `createExpense`, `updateExpense`, `deleteExpense` |
| Documents | `getDocuments`, `uploadDocument`, `deleteDocument` |
| Purchase orders | `getPurchaseOrders`, `createPurchaseOrder`, `updatePurchaseOrder`, `deletePurchaseOrder`, `stockInFromPurchaseOrder` |
| Production runs | `getProductionRuns`, `createProductionRun`, `updateProductionRun`, `deleteProductionRun`, `completeProductionRun`, `getWastageByRunId`, `createWastageRecord`, `deleteWastageRecord`, `getWastageStats` |
| Packaging materials | `getPackagingMaterials`, `createPackagingMaterial`, `updatePackagingMaterial`, `deletePackagingMaterial`, `getPackagingTransactions`, `createPackagingTransaction`, `getPackagingForProduction` |
| Marketing | `getMarketingContacts`, `createMarketingContact`, `updateMarketingContact`, `deleteMarketingContact`, `getChannelExpenses`, `createChannelExpense`, `updateChannelExpense`, `deleteChannelExpense`, `getMarketingCampaigns`, `createMarketingCampaign`, `updateMarketingCampaign`, `deleteMarketingCampaign` |
| AI courier-slip scanning | `logAiScan`, `resolveAiScan`, `getAiScanLog` |
| Alerts | `getLowStockAlerts` |

### 6.2 Notable non-trivial functions

- **`stockInFromPurchaseOrder(po)`** — when a PO's status moves to "received", adds each line item's quantity into the matching ingredient's stock (creates a new FIFO batch). Guarded by a `stock_synced` boolean column on `purchase_orders` so it can never double-apply if the same PO is saved twice.
- **`completeProductionRun(run)`** — the reverse: on completion, consumes raw ingredients FIFO (`consumeIngredientFIFO`) for what the run actually used, and increments finished-goods inventory for the SKU/pack-type produced.
- **`consumeIngredientFIFO(ingredientId, quantityNeeded)`** — walks a raw ingredient's batches oldest-first, decrementing `quantity_remaining` until the need is met, marking exhausted batches `status: 'depleted'`.
- **`deductInventoryForOrder` / `restockInventoryForOrder`** — finished-goods stock adjustment when an order is fulfilled vs. cancelled/returned.
- **`findOrCreateCustomer`** — the canonical customer dedup entry point: looks up by phone first (see §8.6), creates if not found.
- **`getNextInvoiceNumber(forDate)`** — see §8.1, this is load-bearing for GST compliance, do not change the format without re-reading that section.

---

## 7. Pages (Routes) Inventory

All routes are mounted in `App.jsx`, each wrapped in `<ErrorBoundary>` so one page crashing doesn't take down the whole app.

| Route | File | Purpose |
|---|---|---|
| `/` | `Dashboard.jsx` | Month-scoped overview: sales summary (chart + total), pending-actions checklist (follow-up/packing/etc counts), receivables/payables, cash flow, sales-by-channel, top sellers, out-of-stock alerts, recent activity. Reads global `state`, not a fresh fetch — see the staleness note in §4.2. |
| `/quick-order` | `QuickOrder.jsx` | **The primary order-entry flow.** Chrome-free mobile page (no sidebar/header — see `Layout.jsx`'s early-return). Paste a WhatsApp order message → auto-parsed into name/phone/address/city/state/pincode → pick SKUs/qty → save → print label. See §8 for the parsing and repeat-customer/courier-number logic baked into this page. |
| `/orders` | `SalesOrders.jsx` | Full order list/table with an 8-status pipeline of tabs, search, date filter, bulk actions (label print, WhatsApp, tracking import/scan, courier dashboard), and the dedicated Delete Order panel (see §8.5). |
| `/customers` | `CustomerManagement.jsx` | Customer CRUD, order history per customer. |
| `/crm` | `CRM.jsx` | Reorder nudge tracking — flags customers due for a repeat order based on their pack cadence (`reorderCycleDays`; Monthly pack = 4x a Weekly box's cycle). |
| `/skus` | `SKUManagement.jsx` (largest page, ~3080 lines) | Product catalog: 4 SKU types (weekly/recipe-pack, single, repack, resale — see §8.3), each with its own cost-input shape, HSN code, GST rate, packaging materials, selling price (weekly + monthly). |
| `/production` | `ProductionRuns.jsx` (~1674 lines) | Batch production runs: plan → start → complete, ingredient/packaging consumption, labour cost tracking, quality check, wastage logging. |
| `/work-log` | `WorkLog.jsx` | Staff hours/activity logging, separate from production-run labour. |
| `/ingredients` | `IngredientInventory.jsx` | Raw material stock, FIFO batch list per ingredient, expiry tracking, waste recording. |
| `/purchase-orders` | `PurchaseOrders.jsx` (~1141 lines) | Vendor PO lifecycle: draft → ordered → received (triggers `stockInFromPurchaseOrder`). |
| `/packaging` | `PackagingMaterials.jsx` | Packaging stock (pouches, boxes, labels) as its own inventory type, separate from ingredients. |
| `/vendors` | `VendorManagement.jsx` | Vendor CRUD, price history. |
| `/vendor-comparison` | `VendorComparison.jsx` | Side-by-side vendor pricing comparison for the same ingredient. |
| `/pricing` | `PricingStrategy.jsx` (~839 lines) | Cost + margin → selling price planning tool. **Planning-only** — never feeds live order pricing (see §8.2). |
| `/sales` | `SalesRevenue.jsx` (~741 lines) | Revenue analytics. |
| `/inventory` | `InventoryManagement.jsx` | Finished-goods stock view/adjustment. |
| `/invoices` | `InvoiceManagement.jsx` (2nd largest, ~2603 lines) | Invoice list, PDF generation, GST export (CSV, one row per line item — see §8.1), invoice numbering. Also handles `?autoprint=<invoiceId>` deep-link from label printing. |
| `/gst` | `GSTFiling.jsx` | GST filing status/checklist tracking (separate from the InvoiceManagement export). |
| `/expenses` | `Expenses.jsx` | Expense CRUD, including bill-image OCR-assisted entry. |
| `/documents` | `Documents.jsx` | Manual document upload/storage — half-built, see §9. |
| `/reports` | `Reports.jsx` (~665 lines) | Sales/expense/production metrics, monthly revenue trend, **Customer Retention** (phone-keyed, see §8.6), **Breakeven Analysis**. Own date-range filter, own fresh data fetch (not global `state`). |
| `/marketing` | `Marketing.jsx` (~615 lines) | Influencer/campaign tracking — half-built, no real link to orders yet, see §9. |
| `/omni-channels` | `OmniChannels.jsx` | Cross-channel (Amazon/Zoho/WhatsApp/etc) performance view. |
| `/ai-usage` | `AiUsage.jsx` | Dashboard for the courier-slip AI scan feature's usage/accuracy (`ai_scan_log` table). |
| `/help` | `HelpGuide.jsx` | Static in-app help content. |
| `/settings` | `BackupSettings.jsx` (~550 lines) | DB mode (cloud/local), backup export/import, business info (GSTIN, addresses) — the cross-device-synced part, see §4.3/§8. |

---

## 8. Business Logic & Domain Rules

This section is the part most likely to be silently violated by a naive rebuild — each of these was a real bug found and fixed in production use, or a deliberate decision made after a business conversation.

### 8.1 Invoice numbering — GST compliance-critical

- **Format**: `<N>/<MMYYYY>` (e.g. `159/072026` for the 159th invoice, issued July 2026). **Not** any app-invented scheme — this exact format matches what the business's real GST auditor expects.
- Sequence source: a Postgres sequence `invoice_number_seq`, incremented via `supabase.rpc('nextval', ...)`, continuous across the whole system (not reset monthly or per-FY).
- Generated in `dbService.getNextInvoiceNumber(forDate)`, called from `createInvoice` **only if no `invoiceNumber` was already supplied** — so imported/backfilled invoices can carry their real historical number instead of getting a new one.
- **Credit notes** (`credit_notes` table) use a parallel independent sequence (`credit_note_number_seq`), format `CN-<N>/<MMYYYY>`. See §8.4.

### 8.2 Pricing — single source of truth

- **The SKU's own `Selling Price` field (set in SKU Management) is the master price for live orders.** Both a Weekly and a Monthly price are stored per SKU (`weeklyPack`/`monthlyPack` or top-level for other SKU types).
- **`PricingStrategy.jsx` is planning-only.** It's a "what margin am I making if I price at X" sandbox. It must **never** be read when pricing a live order — this was explicitly locked down after a near-miss where a planning number could have leaked into checkout.
- **GST is never added on top of the shown price** — the price is GST-inclusive already. GST% lives as a per-SKU field (`gst_rate` on `skus`) and is used only to *back-calculate* the tax breakup for invoice line items (`subtotal = total / (1 + rate/100)`), not to add extra charge.

### 8.3 SKU costing model (`utils/skuCost.js`)

Four SKU types, each with a genuinely different cost shape — **do not try to unify them**, they represent real different production models:

| `skuType` | Cost basis |
|---|---|
| `weekly` (Recipe Pack, e.g. Day Pack) | Cost stored **per box** (`weeklyPack.rawMaterialCost`). A Monthly order = 4 boxes — this 4x multiplier is a hardcoded, established business rule, not configurable. |
| `single` | Per-unit ingredient list (`singleUnitIngredients`: grams-per-unit × price-per-gram), for items sold as discrete weighed units. |
| `repack` | Bought in bulk (`bulkQty`/`bulkPrice`), repackaged into smaller units (`packSize`) with a `yieldPercent` loss factor (e.g. cleaning loss). |
| `resale` | Bought finished and resold as-is (`buyPrice`), no transformation. |

All four then add **packaging cost** (`packagingMaterials` list, qty × price) and **process cost** (`processCosts` — an open-ended list for roasting/grinding/sealing costs, a cost of *transformation* distinct from a 1:1-consumed material).

This same `itemCost()`/`orderCost()` pair is shared by Marketing's Channel Performance and the Omni Channels page specifically so their COGS numbers stay consistent with each other — don't reimplement this logic per-page.

### 8.4 Credit notes — RTO / COD refusal workflow

When a COD (Cash on Delivery) customer refuses a shipment **after** an invoice already exists for the order:
- **Never edit or delete the original invoice** — it accurately reflects a real supply attempt at the time, and deleting it would break the invoice number sequence used for GST filing.
- Instead, changing the order's status to **Returned (RTO)** on an invoiced order prompts an **"Issue Credit Note"** flow (`OrderDetailView.jsx`): a separate `credit_notes` row referencing the original invoice, defaulting to a 50/50 CGST/SGST split (Tamil Nadu is the overwhelming majority of orders) with IGST defaulted to 0, all fields editable for the interstate/partial-return case.
- This nets out in a later GSTR-1 filing period — it is the textbook-correct way to reverse a taxable supply, not a workaround.

### 8.5 Order deletion — deliberately hard to do wrong

Order deletion is **not** a per-row action (it used to be a per-row trash icon — removed deliberately). It lives behind a dedicated **"Delete Order"** header button on `/orders` (`DeleteOrderPanel.jsx`) that opens a search → confirm flow:
- **Blocks deletion outright** if the order has a linked invoice (`invoice_id` set) — surfaces a message pointing to Cancelled/Returned status + Credit Note instead.
- For non-invoiced orders, requires **typing the order number** to confirm (not just an "Are you sure?" click) before the permanent SQL delete.

### 8.6 Customer identity — phone number is the only stable key

Two related, previously-buggy patterns, now fixed:

1. **Repeat-customer detection / retention stats must key off phone number, not name.** Names get typed differently between orders (WhatsApp/phone orders: "Priya S" vs "Priya Sharma"), which used to silently split one real repeat customer into two "new" ones. `Reports.jsx`'s `customerKey()` normalizes to the last 10 digits of the phone (handles `+91`/`91`-prefixed variants) and falls back to name only when no phone is on file at all. `QuickOrder.jsx`'s "🔁 Repeat customer — Nth order" badge was always phone-based via `dbService.findCustomerByPhone` + counting orders by `customer_id`, so it was never affected by the name-matching bug.
2. **WhatsApp number vs. courier/delivery number can differ.** A customer sometimes messages from one number but gives a *different* number when pasting their delivery address. `sales_orders.courier_number` is a separate column specifically for this: the "Number" box in Quick Order is treated as the immutable WhatsApp/identity number (used for customer lookup, retention, and WhatsApp sending — never overwritten by a paste); if the pasted address text contains a **different** number, it's auto-routed into `courier_number` instead (or typed manually). Shipping labels print `courier_number` if set, else fall back to `phone`. WhatsApp messaging and retention logic always read `phone` only, never `courier_number`.

### 8.7 Promotional/collab orders never get an invoice

`utils/invoiceFromOrder.js`'s `isPromotionalOrder(order)` checks whether `order_source` contains `"promo"` or `"collab"` (case-insensitive). Free samples/giveaways and influencer-collab sends are not a real taxable sale (nothing was paid), so **every** auto-invoice-generation path (Quick Order's label-print flow, Bulk Label Print, Order Detail's print flow, and the manual "Generate Invoice" button) checks this and skips/blocks invoice creation for such orders, showing an explanatory toast instead of silently doing nothing.

### 8.8 COD payment tracking

`payment_method` (`upi | cod | cash | bank_transfer`) and `payment_status` (`pending | received`) are real, editable fields — not decorative. Quick Order has a Prepaid/COD toggle (defaults to Prepaid/UPI): COD orders are created with `payment_status: 'pending'`, `amount_paid: 0`, `balance_due: total_amount` (the cash isn't collected until delivery), vs. prepaid which is treated as paid in full immediately. Order Detail has a "Mark COD Collected" action that flips these once cash is actually in hand.

### 8.9 Order status pipeline

8 sequential stages plus 2 terminal exception states, tracked in `sales_orders.status`:

```
follow_up → confirmed → packing → fulfilled → collected → dispatched → transit → delivered
                                                                              (+ cancelled, returned — reachable from most states)
```

| Status | Meaning |
|---|---|
| `follow_up` | Enquiry/lead, not yet a confirmed order |
| `confirmed` | Order confirmed, awaiting packing |
| `packing` | Label printed / being packed (see `handlePrintLabelOnly` auto-transition) |
| `fulfilled` | Packed, awaiting courier pickup |
| `collected` | Picked up by courier, tracking number pending |
| `dispatched` | Tracking number assigned, in courier's system |
| `transit` | In transit (label says "In Transit") |
| `delivered` | Confirmed delivered |
| `cancelled` | Order cancelled before/without shipping |
| `returned` | RTO / customer refused — see §8.4 for the invoiced-order credit-note flow this triggers |

Restocking finished-goods inventory (`restockInventoryForOrder`) runs automatically when status moves to `returned`.

### 8.10 Order-paste parsing (`utils/orderPasteParser.js` + `addressParser.js`)

Best-effort extraction from a raw pasted WhatsApp/Instagram message into `{ name, phone, address, city, state, pincode, oldStylePostalCode }`:
- Phone: regex-tolerant of spaces/dashes within one line (never bridges two numbers across a newline), strips `+91`/`0` prefixes, validates Indian mobile pattern (`^[6-9]\d{9}$`).
- Name: an explicit `"Name: ..."` line anywhere, else the first substantive line that doesn't look address-y (has its own regex denylist for pincode/street-keyword/phone-label patterns, and a separate check for bare house-number lines like `"No 2/11"` which used to be mistaken for names).
- The returned `address` has the detected name and phone lines stripped out — what's left is exactly what belongs on a shipping label.
- **Explicitly best-effort, meant to be edited, not trusted blind** — real pasted messages format this wildly inconsistently.

### 8.11 Business info & settings — cross-device sync

Most localStorage-backed settings (`utils/settings.js`) are **per-device only** by design (fast, synchronous reads needed for PDF generation) — `dbMode`, `channelFees`, `manualChannels`. The one exception is **`businessInfo`** (company name, GSTIN, registered/return address, phone) — used on every invoice/label PDF, so it's pushed to Supabase (`app_settings` table, generic key/value) on every write via `setBusinessInfo`, and pulled down once at app boot (`syncBusinessInfoFromCloud`, called from `AppContext`) so a second device picks up changes made on the first. **If a new setting needs to be visible across devices, follow this same explicit push/pull pattern — nothing syncs automatically.**

---

## 9. Known Gaps / Deliberately Deprioritized

Per an explicit business decision: the 5 core flows (Orders, Customers, Inventory, Production, Purchasing) get priority; the rest are secondary and should not receive new feature investment without the business asking first:

- **Marketing module** (`Marketing.jsx`, `marketing_contacts`/`marketing_campaigns` tables) — tracked but not actually linked to real order attribution.
- **Documents** (`Documents.jsx`) — manual upload only, no OCR/auto-linking beyond what expenses/bills already get.
- **Production wastage** (`production_wastage` table, `getWastageStats`) — logged but not yet fed back into production cost calculations.
- **Sales targets** (`sales_targets` table) — display-only, no alerting/tracking against actuals.
- **`ProductionSimulator.jsx`** — a "what-if" planning tool, not wired to real data flows.
- **GST Filing page (`GSTFiling.jsx`) vs. Invoice Management's GST export** — two related but separate GST surfaces; the export in `InvoiceManagement.jsx` (`exportGSTReport`) is the one actually used for filing (CSV, one row per invoice line item, HSN codes, channel breakdown). Credit notes are **not yet netted into this export** — a known, explicitly-flagged-but-not-yet-built follow-up (each invoice + its credit note should net to the real taxable value in the period the credit note was issued).

---

## 10. Environment Variables

| Variable | Where used | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | Supabase anon/public key (RLS is permissive — see §5) |
| `VITE_APP_USERNAME` | client | Login username (default `admin`) |
| `VITE_APP_PASSWORD` | client | Login password — **app is non-functional without this set** |
| `GEMINI_API_KEY` | `/api/scan-slip.js` server-side only | Primary courier-slip OCR provider |
| `GROQ_API_KEY` | `/api/scan-slip.js` server-side only | Fallback OCR provider once Gemini's free-tier daily quota (20 req/day/model) is exhausted |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | `/api/settings.js` | Upstash Redis connection, for WhatsApp template storage (keys prefixed `whatsapp_`/`settings_`/`template_`) |

Deployed on **Vercel** (`vercel.json`: Vite framework preset, SPA rewrite so all non-`/api` paths serve `index.html`).

---

## 11. Database Schema (Supabase / Postgres, `public` schema)

All tables use `uuid` primary keys (`gen_random_uuid()`/`uuid_generate_v4()` default) unless noted, `created_at`/`updated_at` timestamptz defaults of `now()`, and RLS enabled with permissive allow-all policies (see §5). Two custom sequences exist outside any table: `invoice_number_seq`, `credit_note_number_seq`.

| Table | Key columns (beyond id/timestamps) |
|---|---|
| `vendors` | name, phone, location, email, ingredients (jsonb) |
| `skus` | name, description, sku_code, hsn_code, gst_rate, target_weight_per_sachet, recipes (jsonb), weekly_pack (jsonb), monthly_pack (jsonb) |
| `pricing_strategies` | sku_id → skus, pack_type, costs (jsonb), margins (jsonb), selling_price — **planning tool, see §8.2** |
| `sales_targets` | month, year, targets (jsonb), fixed_costs (jsonb) |
| `customers` | name, email, phone, address, city, state, pincode, gstin, customer_type, notes |
| `invoices` | invoice_number, customer_id → customers, invoice_date, due_date, items (jsonb), subtotal, tax_rate, tax_amount, discount_amount/percent, total_amount, status, payment_method, payment_date, advance_paid, balance_due, gst_rate, gst_amount, shipping_charge, order_source, terms, notes |
| `credit_notes` | credit_note_number, invoice_id → invoices, invoice_number, order_id → sales_orders, order_number, customer_name, reason, taxable_value, cgst_amount, sgst_amount, igst_amount, total_amount, credit_note_date, notes |
| `inventory` | sku_id → skus, weekly_packs_available, monthly_packs_available, single_units_available, min_stock_threshold, last_updated, notes |
| `inventory_transactions` | sku_id, pack_type, quantity, operation, reason (audit log for inventory changes) |
| `price_history` | vendor_id → vendors, ingredient_name, price_per_unit, unit, changed_by |
| `ingredients` | name, current_stock_total, unit, volatility_score, safety_stock_level |
| `ingredient_batches` | ingredient_id → ingredients, vendor_id → vendors, batch_number, expiry_date, received_date, quantity_initial, quantity_remaining, waste_quantity, price_per_unit, status (FIFO tracking, see §6.2) |
| `sales_orders` | order_number, customer_id → customers, customer_name, order_date, order_source, items (jsonb), subtotal, gst_rate, gst_amount, discount_percent/amount, shipping_charge, total_amount, payment_method, payment_status, amount_paid, balance_due, payment_date, transaction_id, status (§8.9), follow_up_date/notes, shipping_address, **courier_number** (§8.6), courier_name, tracking_number, dispatch_date, estimated/actual_delivery_date, shipping_weight, boxes_small/big, courier_amount, courier_slip_date, qr_code_data, invoice_id → invoices, zoho_order_id, feedback_sent/rating/text/date, label_printed_at, notes, internal_notes |
| `crm_reorder_nudges` | order_id → sales_orders, sku_id, pack_type, sent_at |
| `expenses` | expense_number, category, subcategory, description, vendor_id/name, payee_name, amount, gst_amount, total_amount, payment_method/status, transaction_id, payment_date, bill_number/date/image_url, purchase_order_id, sales_order_id, ocr_data (jsonb), is_recurring, recurring_frequency |
| `documents` | name, description, document_type, file_url/name/size/type, expense_id/vendor_id/sales_order_id (any one, links doc to that record), tags (array) |
| `purchase_orders` | po_number, vendor_id/name, order_date, expected/actual_delivery_date, items (jsonb), subtotal, gst_amount, shipping_charge, total_amount, payment_method/status, amount_paid, transaction_id, status, bill_number/image_url, quality_notes, expense_id, stock_synced (bool guard, see §6.2) |
| `production_runs` | run_number, sku_id/name/code, batch_date, planned/actual/rejected_quantity, pack_type, status, ingredients_used/packaging_used (jsonb), instance_start/end, quality_status/notes/checked_at, started_at/completed_at, ingredient/packaging/labor/total_cost, cost_per_unit, labour_start/end/people/rate_per_hour, labour_sessions (jsonb), process_cost |
| `production_wastage` | production_run_id → production_runs, ingredient_name, waste_quantity_grams, waste_type, cost_impact, is_reusable |
| `sku_instance_counters` | sku_code, counter_date, last_number (per-SKU-per-day sequence for production run instance numbering) |
| `packaging_materials` | name, category, unit, size, current_stock, min_stock, cost_per_unit, vendor_name/phone/address, last_purchase_date/qty/cost |
| `packaging_transactions` | material_id → packaging_materials, type, quantity, unit_cost, total_cost, production_run_id, reference_note, transaction_date |
| `marketing_contacts` | name, platform, handle, followers, contact_date, status, fee, commission_percent, compensation_type, barter_details, orders_generated, revenue_generated |
| `marketing_campaigns` | campaign_name, platform, budget, spend, start/end_date, status, impressions, clicks, orders/revenue_attributed |
| `channel_expenses` | channel, name, amount, frequency, notes |
| `staff` | name, employee_id, rate_per_hour, role, active, mobile, address |
| `work_log` | work_date, activity, start_time, end_time, staff (jsonb), hours, cost, notes |
| `app_settings` | key (text, PK), value (jsonb) — generic cross-device settings store, currently just `businessInfo` |
| `ai_scan_log` | order_id/number, tracking_number, matched_via, confidence, guessed_name, outcome, resolved_at (courier-slip AI-scan audit trail) |

---

## 12. Recreation Checklist (order of operations)

If rebuilding from scratch, this is the dependency order that makes sense:

1. **Supabase project** + apply the schema in §11 (all tables, RLS enabled with allow-all policies, the two sequences).
2. **Vite + React + Tailwind scaffold**, `react-router-dom`, install the dependency list from §2.
3. **`Auth.jsx`** — password gate, session token (§5).
4. **`AppContext.jsx`** — reducer + action types (§4.4) + `dbService`-backed dispatch wrapper + `loadData`/`refreshData` (§4.2).
5. **`services/supabase.js`** (`dbService`) — build out get/create/update/delete for each table (§6.1), matching the camelCase↔snake_case convention exactly.
6. **`Layout.jsx`** — sidebar nav groups (Sales/Products/Inventory/Growth/Finance), header, test-mode toggle.
7. Build pages **in this priority order** (matches the business's real priority, §1/§9): SKU Management → Vendors/Ingredients/Purchase Orders (inventory chain) → Production Runs → Customers → Sales Orders + Quick Order (get the paste-parser and courier-number logic right, §8.6/§8.10) → Invoice Management (get the invoice numbering exactly right, §8.1) → Pricing Strategy (as planning-only, §8.2) → Reports (phone-keyed retention, §8.6) → everything else.
8. Wire in the two Vercel API routes only once courier-slip scanning is actually needed (§6.2's `ocrMatch.js` counterpart, `api/scan-slip.js`) — this is a nice-to-have, not core.
9. Read §8 in full before writing any order/invoice/customer logic — nearly every rule there exists because the naive first implementation got it wrong once already.

---

## 13. Things Explicitly *Not* To Reintroduce

A short list of specific mistakes already made and fixed once in this codebase's history — a recreation attempt is likely to re-invent these unless warned:

- Inventing a custom invoice number format instead of `<N>/<MMYYYY>` (§8.1).
- Letting `PricingStrategy.jsx`'s numbers leak into a live order's price (§8.2).
- Adding GST on top of the SKU's selling price instead of treating it as inclusive (§8.2).
- Matching customers/retention stats by name text instead of phone number (§8.6).
- A pasted address silently overwriting a manually-typed WhatsApp number (§8.6).
- A per-row delete icon on the orders list with no invoice-linked guard (§8.5).
- Auto-generating a GST invoice for a free promo/collab send (§8.7).
- Editing or deleting an already-invoiced order instead of using a Credit Note for RTO/refusal (§8.4).
- Assuming Dashboard numbers are always live — they're a snapshot from last load (§4.2).
