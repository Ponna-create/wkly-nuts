// Every price we know for a raw material, per vendor, for Vendors → Compare.
//
// Two kinds of price:
//   bill  – what was actually paid: one point per stock lot a bill or purchase
//           order created (price per kg, the grade bought, the bill's quality rating)
//   quote – a vendor's price list or a market price typed in (price_history),
//           not a purchase. Rows copied from bills ('Bill …') are skipped,
//           because the lot already counts.
// Prices are grouped by product (Almonds, Cashews, …). Quotes use loose names
// ("Salted Pista", "cashwes"), so they are matched to a product by keyword.
import { keyOf } from './billItemMatch';

const RULES = [
  [/almond/, 'Almonds'], [/cash|cashw/, 'Cashews'], [/pista/, 'Pistachios'], [/walnut/, 'Walnuts'],
  [/black.*(raisin|grape)/, 'Black Raisins'], [/(yellow|golden).*raisin|drygrapes/, 'Yellow Raisins'],
  [/fig/, 'Dry Figs'], [/date.*byte|dates.*bite/, 'Date Bytes 250g'], [/date/, 'Dates'],
  [/pumpkin/, 'Pumpkin Seeds'], [/sunflower/, 'Sunflower Seeds'], [/fl[ae]x/, 'Flax Seeds'], [/chia/, 'Chia Seeds'],
  [/sesame/, 'White Sesame Seeds'],
];

export function productOfName(name, products) {
  const k = keyOf(name);
  const exact = products.find(p => keyOf(p) === k || keyOf(p).replace(/s$/, '') === k.replace(/s$/, ''));
  if (exact) return exact;
  const low = String(name || '').toLowerCase();
  const hit = RULES.find(([re]) => re.test(low));
  return hit && products.includes(hit[1]) ? hit[1] : null;
}

export function buildPricePoints({ ingredients = [], quotes = [], vendors = [], expenses = [], orders = [] }) {
  const products = [...new Set(ingredients.map(i => i.product || i.name))];
  const vendorName = Object.fromEntries(vendors.map(v => [v.id, String(v.name || '').trim()]));
  const expById = Object.fromEntries(expenses.map(e => [e.id, e]));
  const poByNumber = Object.fromEntries(orders.map(o => [o.po_number, o]));
  const points = [];

  ingredients.forEach(ing => (ing.ingredient_batches || []).forEach(lot => {
    const price = parseFloat(lot.price_per_unit) || 0;
    const qty = parseFloat(lot.quantity_initial) || 0;
    if (price <= 0 || qty <= 0 || /^COUNT-/.test(lot.batch_number || '')) return;
    const exp = lot.expense_id ? expById[lot.expense_id] : null;
    const po = poByNumber[String(lot.batch_number || '').slice(0, 13)];
    const vid = lot.vendor_id || exp?.vendor_id || po?.vendor_id || null;
    points.push({
      source: 'bill', product: ing.product || ing.name, item: ing.name, grade: ing.grade && ing.grade !== 'Standard' ? ing.grade : '',
      vendorId: vid, vendor: vendorName[vid] || (exp?.vendor_name || po?.vendor_name || 'Unknown vendor').trim(),
      date: String(lot.received_date || exp?.bill_date || '').slice(0, 10), price, qty, unit: ing.unit || 'Kg',
      ref: lot.bill_number ? `Bill ${lot.bill_number}` : (po?.po_number || ''),
      rating: exp?.quality_rating || po?.quality_rating || null,
      billKey: exp ? `exp-${exp.id}` : po ? `po-${po.id}` : `lot-${lot.id}`,
    });
  }));

  quotes.forEach(q => {
    if (/^Bill /.test(q.changed_by || '')) return;
    const product = productOfName(q.ingredient_name, products);
    const price = parseFloat(q.price_per_unit) || 0;
    if (!product || price <= 0) return;
    points.push({
      source: 'quote', product, item: String(q.ingredient_name || '').trim(), grade: '',
      vendorId: q.vendor_id, vendor: vendorName[q.vendor_id] || 'Unknown vendor',
      date: String(q.created_at || '').slice(0, 10), price, unit: q.unit || 'kg',
      ref: q.changed_by && q.changed_by !== 'system' ? q.changed_by : 'Price list',
    });
  });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

// One row per vendor for a product: last price paid, range, bills, last quote, quality.
export function compareVendors(points, product) {
  const mine = points.filter(p => p.product === product);
  const byVendor = {};
  mine.forEach(p => {
    const v = byVendor[p.vendor] || (byVendor[p.vendor] = { vendor: p.vendor, vendorId: p.vendorId, bills: [], quotes: [], ratings: {} });
    if (p.source === 'bill') {
      v.bills.push(p);
      if (p.rating) v.ratings[p.billKey] = p.rating;
    } else v.quotes.push(p);
  });
  return Object.values(byVendor).map(v => {
    const lastBill = v.bills[v.bills.length - 1] || null;
    const lastQuote = v.quotes[v.quotes.length - 1] || null;
    const prices = v.bills.map(b => b.price);
    const r = Object.values(v.ratings);
    const kg = v.bills.reduce((t, b) => t + b.qty, 0);
    const spend = v.bills.reduce((t, b) => t + b.qty * b.price, 0);
    return {
      ...v, lastBill, lastQuote,
      billCount: new Set(v.bills.map(b => b.billKey)).size,
      low: prices.length ? Math.min(...prices) : null, high: prices.length ? Math.max(...prices) : null,
      avgPaid: kg > 0 ? spend / kg : null, kg,
      rating: r.length ? r.reduce((t, x) => t + x, 0) / r.length : null, ratedBills: r.length,
      latest: [lastBill, lastQuote].filter(Boolean).sort((a, b) => b.date.localeCompare(a.date))[0] || null,
    };
  }).sort((a, b) => (b.lastBill?.date || b.latest?.date || '').localeCompare(a.lastBill?.date || a.latest?.date || ''));
}
