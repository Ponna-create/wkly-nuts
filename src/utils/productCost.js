// What one box costs, on any date, and the cost of products SENT (not sold):
// influencer / collab orders. Reports, Profit & Cost, Expenses and Marketing
// all use this, so a price rise counts only from the bill that raised it.
import { boxesForPacks, boxesPerMonthly } from './packSize';
import { stockIdsForLine } from './batchRecipe';

const num = (v) => parseFloat(v) || 0;

// Packaging + process costs of one box, as typed in SKU Management.
export function packagingAndProcess(sku) {
  const wp = sku.weeklyPack || sku.weekly_pack || {};
  const packaging = (sku.packagingMaterials || wp.packaging || []).reduce((t, p) => t + num(p.quantity_per_pack) * num(p.price_per_unit), 0);
  const process = (sku.processCosts || wp.processCosts || []).reduce((t, p) => t + num(p.cost_per_unit), 0);
  return packaging + process;
}

// Cost of one box worked out from the product's own costing in SKU
// Management (ingredients + packaging + process costs), for when no
// trustworthy batch cost exists yet. null when nothing is filled in.
export function standardBoxCost(sku) {
  if (!sku) return null;
  const wp = sku.weeklyPack || sku.weekly_pack || {};
  const type = sku.skuType || wp.skuType || 'weekly';
  let ingredients = 0;
  if (type === 'weekly') ingredients = num(wp.rawMaterialCost);
  else if (type === 'single') ingredients = (sku.singleUnitIngredients || wp.singleUnitIngredients || []).reduce((t, i) => t + num(i.gramsPerUnit) * num(i.pricePerGram), 0);
  else if (type === 'repack') {
    const bulkQty = num(sku.bulkQty || wp.bulkQty), bulkPrice = num(sku.bulkPrice || wp.bulkPrice), packSize = num(sku.packSize || wp.packSize);
    ingredients = bulkQty > 0 && packSize > 0 ? bulkPrice / ((bulkQty * 1000) / packSize) : 0;
  } else if (type === 'resale') ingredients = num(sku.buyPrice || wp.buyPrice);
  const total = ingredients + packagingAndProcess(sku);
  return total > 0 ? total : null;
}

// A batch cost is trusted only when the batch recorded both ingredients and
// packaging taken from stock. Batches made before recipes were linked to
// stock items (Oct 2026) often recorded part of the ingredients and no
// packaging (a Day Pack batch came out at ₹7 a box), so they're skipped.
const trustedRun = (r) => r.status === 'completed' && num(r.cost_per_unit) > 0 && num(r.ingredient_cost) > 0 && num(r.packaging_cost) > 0;

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const dayOf = (v) => String(v || '').slice(0, 10);
export const todayStr = () => new Date().toISOString().slice(0, 10);

// ₹/kg on a date: the latest bill on or before it (same-day bills averaged by
// quantity). Before the first bill, the first bill's price. Shelf-count lots
// and voided lots are not purchases, and items not held in kg can't be priced by grams.
export function billRateAt(ids, ingredients, date) {
  const wanted = ids.map(String);
  const lots = (ingredients || [])
    .filter(i => wanted.includes(String(i.id)) && String(i.unit || 'kg').toLowerCase() === 'kg')
    .flatMap(i => i.ingredient_batches || [])
    .filter(l => num(l.price_per_unit) > 0 && num(l.quantity_initial) > 0 && l.received_date && !/^COUNT-/.test(l.batch_number || ''));
  if (!lots.length) return null;
  const days = lots.map(l => dayOf(l.received_date)).sort();
  const before = days.filter(d => d <= date);
  const day = before.length ? before[before.length - 1] : days[0];
  const same = lots.filter(l => dayOf(l.received_date) === day);
  const qty = same.reduce((t, l) => t + num(l.quantity_initial), 0);
  return same.reduce((t, l) => t + num(l.quantity_initial) * num(l.price_per_unit), 0) / qty;
}

// Ingredient cost of one box at the bill prices of a date. A line with no bill
// yet keeps the price saved on the recipe and is listed in `notFromBills`.
export function recipeCostAt(sku, ingredients, date = todayStr()) {
  const wp = sku?.weeklyPack || sku?.weekly_pack || {};
  const type = sku?.skuType || wp.skuType || 'weekly';
  const rows = type === 'weekly'
    ? DAYS.flatMap(d => (sku?.recipes?.[d] || []).map(i => ({ item: i, grams: num(i.gramsPerSachet || i.quantityPerSachet) })))
    : type === 'single'
      ? (sku?.singleUnitIngredients || wp.singleUnitIngredients || []).map(i => ({ item: i, grams: num(i.gramsPerUnit) }))
      : [];
  let cost = 0;
  let fromBills = 0;
  const notFromBills = new Set();
  rows.forEach(({ item, grams }) => {
    if (!grams) return;
    const name = (item.ingredientName || item.ingredient_name || '').trim();
    const ids = stockIdsForLine({ stock_item_id: item.stockItemId, stock_product: item.stockProduct, stock_grade: item.stockGrade, ingredient_name: name }, ingredients);
    const rate = billRateAt(ids, ingredients, date);
    if (rate != null) { cost += (grams / 1000) * rate; fromBills += 1; } else {
      cost += grams * num(item.pricePerGram);
      if (name) notFromBills.add(name);
    }
  });
  return { cost, lines: rows.length, fromBills, notFromBills: [...notFromBills] };
}

// costAt(skuId, date) -> { cost, source: 'batch' | 'bills' | 'estimate', run } or null
//  batch:    latest trusted batch finished on or before the date
//  bills:    the recipe at the bill prices of that date + packaging + process costs
//  estimate: no bill to go on, the typed costs in SKU Management
export function makeBoxCoster({ runs, skus, ingredients }) {
  const trusted = (runs || []).filter(trustedRun)
    .sort((a, b) => new Date(b.completed_at || b.batch_date) - new Date(a.completed_at || a.batch_date));
  const memo = new Map();
  return (skuId, date = todayStr()) => {
    const key = `${skuId}|${date}`;
    if (memo.has(key)) return memo.get(key);
    const sku = (skus || []).find(s => String(s.id) === String(skuId));
    let out = null;
    const run = trusted.find(r => String(r.sku_id) === String(skuId) && dayOf(r.completed_at || r.batch_date) <= date);
    if (run) {
      const mult = run.pack_type === 'monthly' ? boxesPerMonthly(sku) : 1;
      out = { cost: num(run.cost_per_unit) / mult, source: 'batch', run };
    } else if (sku) {
      const rc = recipeCostAt(sku, ingredients, date);
      if (rc.fromBills > 0) out = { cost: rc.cost + packagingAndProcess(sku), source: 'bills', notFromBills: rc.notFromBills };
      else {
        const est = standardBoxCost(sku);
        if (est != null) out = { cost: est, source: 'estimate' };
      }
    }
    memo.set(key, out);
    return out;
  };
}

// What one influencer has been sent, from the orders linked to them in Quick Order.
export function productsSentTo(contactId, orders, skus, costAt) {
  const mine = (orders || []).filter(o => String(o.influencer_id || '') === String(contactId) && o.status !== 'cancelled');
  return productCostOfOrders(mine, skus, costAt);
}

// Units, cost (box cost on each order's date) and retail value of a set of free-send orders.
export function productCostOfOrders(mine, skus, costAt) {
  let units = 0;
  let cost = 0;
  let retail = 0;
  let costKnown = true;
  mine.forEach(o => (o.items || []).forEach(it => {
    const id = it.sku_id || it.skuId;
    const sku = (skus || []).find(s => String(s.id) === String(id));
    const u = boxesForPacks(sku, it.pack_type || it.packType, it.quantity);
    units += u;
    retail += num(it.total) || num(it.unit_price || it.unitPrice) * num(it.quantity);
    const c = id && costAt ? costAt(id, dayOf(o.order_date || o.created_at)) : null;
    if (c) cost += c.cost * u;
    else costKnown = false;
  }));
  return { orders: mine.length, units, cost, retail, costKnown };
}
