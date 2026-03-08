// Mock DB Service — localStorage-based, mirrors dbService API
import { generateSeedData } from './mockData';

const STORAGE_KEY = 'wkly_test_db';

function getDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // First time: seed
  const seed = generateSeedData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function table(name) {
  const db = getDB();
  return db[name] || [];
}

function saveTable(name, rows) {
  const db = getDB();
  db[name] = rows;
  saveDB(db);
}

// Sequence counters
function nextSeq(prefix, tableName, field) {
  const rows = table(tableName);
  const nums = rows.map(r => {
    const m = (r[field] || '').match(/(\d+)$/);
    return m ? parseInt(m[1]) : 0;
  });
  const next = Math.max(0, ...nums) + 1;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(next).padStart(5, '0')}`;
}

// ═══════════════════════════════════════════
//  MOCK DB SERVICE
// ═══════════════════════════════════════════
export const mockDbService = {

  // ── Reset test data ──
  resetTestData() {
    localStorage.removeItem(STORAGE_KEY);
    const seed = generateSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  },

  // ══════════ CUSTOMERS ══════════
  async getCustomers() {
    return { data: table('customers'), error: null };
  },
  async createCustomer(c) {
    const rows = table('customers');
    const rec = { id: crypto.randomUUID(), ...c, created_at: new Date().toISOString() };
    rows.push(rec);
    saveTable('customers', rows);
    return { data: rec, error: null };
  },
  async updateCustomer(c) {
    const rows = table('customers');
    const idx = rows.findIndex(r => r.id === c.id);
    if (idx >= 0) { rows[idx] = { ...rows[idx], ...c }; saveTable('customers', rows); }
    return { data: rows[idx], error: null };
  },
  async deleteCustomer(id) {
    saveTable('customers', table('customers').filter(r => r.id !== id));
    return { error: null };
  },

  // ══════════ SALES ORDERS ══════════
  async getSalesOrders() {
    const rows = table('sales_orders').sort((a, b) => b.order_date?.localeCompare(a.order_date));
    return { data: rows, error: null };
  },
  async getSalesOrderById(id) {
    const row = table('sales_orders').find(r => r.id === id);
    return { data: row || null, error: row ? null : { message: 'Not found' } };
  },
  async createSalesOrder(order) {
    const rows = table('sales_orders');
    const rec = {
      id: crypto.randomUUID(),
      order_number: nextSeq('SO', 'sales_orders', 'order_number'),
      ...order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    rows.unshift(rec);
    saveTable('sales_orders', rows);
    return { data: rec, error: null };
  },
  async updateSalesOrder(order) {
    const rows = table('sales_orders');
    const idx = rows.findIndex(r => r.id === order.id);
    if (idx < 0) return { data: null, error: { message: 'Not found' } };

    // Accept both camelCase and snake_case (mirror real service)
    const pick = (camel, snake) => order[camel] !== undefined ? order[camel] : order[snake];
    const fields = [
      'customer_id', 'customer_name', 'phone', 'email', 'shipping_address', 'city', 'pincode',
      'order_source', 'order_date', 'status', 'payment_method', 'payment_status',
      'items', 'subtotal', 'gst_amount', 'total_amount', 'tracking_number', 'courier_name',
      'dispatch_date', 'notes',
    ];
    const camelMap = {
      customer_id: 'customerId', customer_name: 'customerName', tracking_number: 'trackingNumber',
      courier_name: 'courierName', dispatch_date: 'dispatchDate', order_date: 'orderDate',
      order_source: 'orderSource', payment_method: 'paymentMethod', payment_status: 'paymentStatus',
      total_amount: 'totalAmount', gst_amount: 'gstAmount', shipping_address: 'shippingAddress',
    };

    for (const f of fields) {
      const val = pick(camelMap[f] || f, f);
      if (val !== undefined) rows[idx][f] = val;
    }
    rows[idx].updated_at = new Date().toISOString();
    saveTable('sales_orders', rows);
    return { data: rows[idx], error: null };
  },
  async deleteSalesOrder(id) {
    saveTable('sales_orders', table('sales_orders').filter(r => r.id !== id));
    return { error: null };
  },

  // ══════════ PURCHASE ORDERS ══════════
  async getPurchaseOrders() {
    return { data: table('purchase_orders').sort((a, b) => b.order_date?.localeCompare(a.order_date)), error: null };
  },
  async createPurchaseOrder(po) {
    const rows = table('purchase_orders');
    const rec = {
      id: crypto.randomUUID(),
      po_number: nextSeq('PO', 'purchase_orders', 'po_number'),
      ...po,
      created_at: new Date().toISOString(),
    };
    rows.unshift(rec);
    saveTable('purchase_orders', rows);
    return { data: rec, error: null };
  },
  async updatePurchaseOrder(po) {
    const rows = table('purchase_orders');
    const idx = rows.findIndex(r => r.id === po.id);
    if (idx >= 0) { rows[idx] = { ...rows[idx], ...po, updated_at: new Date().toISOString() }; saveTable('purchase_orders', rows); }
    return { data: rows[idx], error: null };
  },
  async deletePurchaseOrder(id) {
    saveTable('purchase_orders', table('purchase_orders').filter(r => r.id !== id));
    return { error: null };
  },

  // ══════════ EXPENSES ══════════
  async getExpenses() {
    return { data: table('expenses').sort((a, b) => b.expense_date?.localeCompare(a.expense_date)), error: null };
  },
  async createExpense(e) {
    const rows = table('expenses');
    const rec = { id: crypto.randomUUID(), ...e, created_at: new Date().toISOString() };
    rows.unshift(rec);
    saveTable('expenses', rows);
    return { data: rec, error: null };
  },
  async updateExpense(e) {
    const rows = table('expenses');
    const idx = rows.findIndex(r => r.id === e.id);
    if (idx >= 0) { rows[idx] = { ...rows[idx], ...e }; saveTable('expenses', rows); }
    return { data: rows[idx], error: null };
  },
  async deleteExpense(id) {
    saveTable('expenses', table('expenses').filter(r => r.id !== id));
    return { error: null };
  },

  // ══════════ PACKAGING MATERIALS ══════════
  async getPackagingMaterials() {
    return { data: table('packaging_materials'), error: null };
  },
  async createPackagingMaterial(m) {
    const rows = table('packaging_materials');
    const rec = { id: crypto.randomUUID(), ...m, created_at: new Date().toISOString() };
    rows.push(rec);
    saveTable('packaging_materials', rows);
    return { data: rec, error: null };
  },
  async updatePackagingMaterial(m) {
    const rows = table('packaging_materials');
    const idx = rows.findIndex(r => r.id === m.id);
    if (idx >= 0) { rows[idx] = { ...rows[idx], ...m }; saveTable('packaging_materials', rows); }
    return { data: rows[idx], error: null };
  },
  async deletePackagingMaterial(id) {
    saveTable('packaging_materials', table('packaging_materials').filter(r => r.id !== id));
    return { error: null };
  },

  // ══════════ INGREDIENTS ══════════
  async getIngredients() { return { data: table('ingredients'), error: null }; },
  async createIngredient(i) {
    const rows = table('ingredients');
    const rec = { id: crypto.randomUUID(), ...i, created_at: new Date().toISOString() };
    rows.push(rec);
    saveTable('ingredients', rows);
    return { data: rec, error: null };
  },
  async updateIngredient(i) {
    const rows = table('ingredients');
    const idx = rows.findIndex(r => r.id === i.id);
    if (idx >= 0) { rows[idx] = { ...rows[idx], ...i }; saveTable('ingredients', rows); }
    return { data: rows[idx], error: null };
  },
  async deleteIngredient(id) {
    saveTable('ingredients', table('ingredients').filter(r => r.id !== id));
    return { error: null };
  },

  // ══════════ PRODUCTION RUNS ══════════
  async getProductionRuns() { return { data: table('production_runs'), error: null }; },
  async createProductionRun(r) {
    const rows = table('production_runs');
    const rec = { id: crypto.randomUUID(), ...r, created_at: new Date().toISOString() };
    rows.push(rec);
    saveTable('production_runs', rows);
    return { data: rec, error: null };
  },
  async updateProductionRun(r) {
    const rows = table('production_runs');
    const idx = rows.findIndex(x => x.id === r.id);
    if (idx >= 0) { rows[idx] = { ...rows[idx], ...r }; saveTable('production_runs', rows); }
    return { data: rows[idx], error: null };
  },

  // ══════════ STUBS ══════════
  // These return empty/safe results so the app doesn't crash
  async getVendors() { return { data: [], error: null }; },
  async getDocuments() { return { data: [], error: null }; },
  async createDocument() { return { data: null, error: null }; },
  async deleteDocument() { return { error: null }; },
  async getIngredientBatches() { return { data: [], error: null }; },
  async addIngredientBatch() { return { data: null, error: null }; },
  async stockInFromPurchaseOrder(po) {
    return { success: (po.items || []).length, errors: [] };
  },
  async deductInventoryForOrder() {
    return { deducted: 0, warnings: [] };
  },
  async getPackagingTransactions() { return { data: [], error: null }; },
  async createPackagingTransaction() { return { data: null, error: null }; },
  async getPricingStrategies() { return { data: [], error: null }; },
  async savePricingStrategy() { return { data: null, error: null }; },
  async getSKUs() { return { data: table('skus'), error: null }; },
};
