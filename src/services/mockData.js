// Mock seed data for Test Mode - mirrors real WKLY Nuts business
const uuid = () => crypto.randomUUID();

const now = new Date();
const today = now.toISOString().split('T')[0];
const daysAgo = (n) => new Date(now - n * 86400000).toISOString().split('T')[0];

// ── Customers ──
const CUSTOMERS = [
  { id: uuid(), name: 'Srilatha vgn', phone: '9876543210', email: 'srilatha@test.com', shipping_address: 'No: VGN PLATINA, Ambigai Nagar, MGR Nagar, Ayappakkam', city: 'Chennai', pincode: '600077' },
  { id: uuid(), name: 'Priya Kumar', phone: '9876543211', email: 'priya@test.com', shipping_address: '12 Anna Nagar, 2nd Street', city: 'Chennai', pincode: '600040' },
  { id: uuid(), name: 'Ravi Shankar', phone: '9876543212', email: 'ravi@test.com', shipping_address: '45 T Nagar, South Usman Road', city: 'Chennai', pincode: '600017' },
  { id: uuid(), name: 'Deepa Mohan', phone: '9876543213', email: 'deepa@test.com', shipping_address: '8 Velachery Main Road', city: 'Chennai', pincode: '600042' },
  { id: uuid(), name: 'Karthik R', phone: '9876543214', email: 'karthik@test.com', shipping_address: '22 ECR, Sholinganallur', city: 'Chennai', pincode: '600119' },
];

// ── SKUs ──
const SKUS = [
  { id: uuid(), name: 'Day Pack', code: 'DP', description: 'Premium daily nuts mix' },
  { id: uuid(), name: 'Soak Overnight', code: 'SO', description: 'Overnight soaking mix' },
  { id: uuid(), name: 'Seed Cycle', code: 'SC', description: 'Seed cycling blend' },
  { id: uuid(), name: 'Date Bytes', code: 'DB', description: 'Date-based energy bites' },
];

// ── Sales Orders ──
function buildOrders() {
  const statuses = ['follow_up', 'packing', 'packed', 'dispatched', 'in_transit', 'delivered'];
  const sources = ['whatsapp', 'website', 'instagram', 'meta_ad'];
  const orders = [];

  for (let i = 0; i < 12; i++) {
    const cust = CUSTOMERS[i % CUSTOMERS.length];
    const sku = SKUS[i % SKUS.length];
    const status = statuses[i % statuses.length];
    const packType = i % 3 === 0 ? 'monthly' : 'weekly';
    const qty = packType === 'monthly' ? 1 : Math.ceil(Math.random() * 3);
    const unitPrice = packType === 'monthly' ? 1499 : 379;
    const total = qty * unitPrice;
    const orderDate = daysAgo(Math.floor(i / 2));

    orders.push({
      id: uuid(),
      order_number: `SO-2026-${String(i + 1).padStart(5, '0')}`,
      customer_id: cust.id,
      customer_name: cust.name,
      phone: cust.phone,
      email: cust.email,
      shipping_address: cust.shipping_address,
      city: cust.city,
      pincode: cust.pincode,
      order_source: sources[i % sources.length],
      order_date: orderDate,
      status,
      payment_method: i % 2 === 0 ? 'upi' : 'cod',
      payment_status: status === 'follow_up' ? 'pending' : 'paid',
      items: [{
        sku_id: sku.id,
        sku_name: sku.name,
        sku_code: sku.code,
        pack_type: packType,
        quantity: qty,
        unit_price: unitPrice,
        total,
      }],
      subtotal: total,
      gst_amount: Math.round(total * 0.05),
      total_amount: total + Math.round(total * 0.05),
      tracking_number: ['dispatched', 'in_transit', 'delivered'].includes(status) ? `ST${100000 + i}` : '',
      courier_name: ['dispatched', 'in_transit', 'delivered'].includes(status) ? 'ST Courier' : '',
      dispatch_date: ['dispatched', 'in_transit', 'delivered'].includes(status) ? orderDate : null,
      notes: '',
      created_at: new Date(orderDate).toISOString(),
      updated_at: new Date(orderDate).toISOString(),
    });
  }
  return orders;
}

// ── Purchase Orders ──
function buildPurchaseOrders() {
  return [
    {
      id: uuid(),
      po_number: 'PO-2026-00001',
      vendor_name: 'DRY FRUITS Sowcarpet Chennai',
      order_date: daysAgo(7),
      status: 'received',
      items: [
        { name: 'Almonds Regular', quantity: 3, unit: 'kg', unit_price: 880, gst_percent: 5, total: 2640 },
        { name: 'Walnuts 2pcs Chile', quantity: 2, unit: 'kg', unit_price: 1420, gst_percent: 5, total: 2840 },
        { name: 'Cashew A320', quantity: 2, unit: 'kg', unit_price: 800, gst_percent: 5, total: 1600 },
        { name: 'Drygrapes Indian', quantity: 2, unit: 'kg', unit_price: 480, gst_percent: 5, total: 960 },
        { name: 'Pumpkin Seeds', quantity: 2, unit: 'kg', unit_price: 425, gst_percent: 5, total: 850 },
      ],
      total_amount: 8890,
      payment_method: 'upi',
      payment_status: 'paid',
      notes: 'Monthly raw material stock',
      created_at: new Date(daysAgo(7)).toISOString(),
    },
    {
      id: uuid(),
      po_number: 'PO-2026-00002',
      vendor_name: 'Local Packaging Store',
      order_date: daysAgo(5),
      status: 'received',
      items: [
        { name: 'Weekly Box (21.6x14x10.2cm)', quantity: 50, unit: 'pcs', unit_price: 11, gst_percent: 18, total: 649 },
        { name: 'Monthly Box (26.7x20.3x21.6cm)', quantity: 20, unit: 'pcs', unit_price: 20, gst_percent: 18, total: 472 },
        { name: 'Sachets 100g', quantity: 500, unit: 'pcs', unit_price: 2, gst_percent: 18, total: 1180 },
      ],
      total_amount: 2301,
      payment_method: 'cash',
      payment_status: 'paid',
      notes: 'Packaging restock',
      created_at: new Date(daysAgo(5)).toISOString(),
    },
  ];
}

// ── Expenses ──
function buildExpenses() {
  return [
    { id: uuid(), expense_date: daysAgo(3), description: 'ST Courier - 5 shipments', category: 'courier', vendor_name: 'ST Courier', amount: 750, gst_amount: 0, total_amount: 750, payment_method: 'upi', payment_status: 'paid', bill_number: 'AWB-2026-03' },
    { id: uuid(), expense_date: daysAgo(5), description: 'Meta Ads - March Week 1', category: 'advertising', vendor_name: 'Meta', amount: 2000, gst_amount: 360, total_amount: 2360, payment_method: 'upi', payment_status: 'paid', bill_number: '' },
    { id: uuid(), expense_date: daysAgo(7), description: 'Label printer ribbon', category: 'equipment', vendor_name: 'Amazon', amount: 450, gst_amount: 81, total_amount: 531, payment_method: 'upi', payment_status: 'paid', bill_number: 'AMZ-001' },
    { id: uuid(), expense_date: daysAgo(1), description: 'Nitrogen gas refill', category: 'packaging', vendor_name: 'Industrial Gas Co', amount: 800, gst_amount: 144, total_amount: 944, payment_method: 'cash', payment_status: 'paid', bill_number: '' },
  ];
}

// ── Packaging Materials ──
function buildPackaging() {
  return [
    { id: uuid(), name: 'Weekly Box', category: 'boxes', unit: 'pcs', current_stock: 42, min_stock: 20, cost_per_unit: 11 },
    { id: uuid(), name: 'Monthly Box', category: 'boxes', unit: 'pcs', current_stock: 15, min_stock: 10, cost_per_unit: 20 },
    { id: uuid(), name: 'Sachet 100g', category: 'sachets', unit: 'pcs', current_stock: 350, min_stock: 100, cost_per_unit: 2 },
    { id: uuid(), name: 'Labels (roll)', category: 'labels', unit: 'rolls', current_stock: 3, min_stock: 2, cost_per_unit: 150 },
    { id: uuid(), name: 'Packing Tape', category: 'tape', unit: 'rolls', current_stock: 8, min_stock: 5, cost_per_unit: 45 },
    { id: uuid(), name: 'Nitrogen Cans', category: 'nitrogen', unit: 'cans', current_stock: 4, min_stock: 2, cost_per_unit: 200 },
  ];
}

export function generateSeedData() {
  return {
    customers: CUSTOMERS,
    skus: SKUS,
    sales_orders: buildOrders(),
    purchase_orders: buildPurchaseOrders(),
    expenses: buildExpenses(),
    packaging_materials: buildPackaging(),
    ingredients: [],
    production_runs: [],
  };
}
