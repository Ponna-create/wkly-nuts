// Cost of products that were SENT (not sold): influencer / collab orders.
// Their cost per box comes from the most recent finished batch of each product
// (ingredients + packaging + labour), the same figure the Profit & Cost report uses.
import { boxesForPacks, boxesPerMonthly } from './packSize';

const num = (v) => parseFloat(v) || 0;

// Cost of one box worked out from the product's own costing in SKU
// Management (ingredients + packaging + process costs), for when no
// trustworthy batch cost exists yet. null when nothing is filled in.
export function standardBoxCost(sku) {
  if (!sku) return null;
  const wp = sku.weeklyPack || sku.weekly_pack || {};
  const type = sku.skuType || wp.skuType || 'weekly';
  const packaging = (sku.packagingMaterials || wp.packaging || []).reduce((t, p) => t + num(p.quantity_per_pack) * num(p.price_per_unit), 0);
  const process = (sku.processCosts || wp.processCosts || []).reduce((t, p) => t + num(p.cost_per_unit), 0);
  let ingredients = 0;
  if (type === 'weekly') ingredients = num(wp.rawMaterialCost);
  else if (type === 'single') ingredients = (sku.singleUnitIngredients || wp.singleUnitIngredients || []).reduce((t, i) => t + num(i.gramsPerUnit) * num(i.pricePerGram), 0);
  else if (type === 'repack') {
    const bulkQty = num(sku.bulkQty || wp.bulkQty), bulkPrice = num(sku.bulkPrice || wp.bulkPrice), packSize = num(sku.packSize || wp.packSize);
    ingredients = bulkQty > 0 && packSize > 0 ? bulkPrice / ((bulkQty * 1000) / packSize) : 0;
  } else if (type === 'resale') ingredients = num(sku.buyPrice || wp.buyPrice);
  const total = ingredients + packaging + process;
  return total > 0 ? total : null;
}

// A batch cost is trusted only when the batch recorded both ingredients and
// packaging taken from stock. Batches made before recipes were linked to
// stock items (Oct 2026) often recorded part of the ingredients and no
// packaging (a Day Pack batch came out at ₹7 a box), so they're skipped.
const trustedRun = (r) => r.status === 'completed' && num(r.cost_per_unit) > 0 && num(r.ingredient_cost) > 0 && num(r.packaging_cost) > 0;

// { map: { [skuId]: costPerBox }, source: { [skuId]: 'batch' | 'estimate' } }
// Latest trusted batch per product, else the SKU costing estimate.
export function costPerBoxInfo(runs, skus) {
  const map = {};
  const source = {};
  (runs || [])
    .filter(trustedRun)
    .sort((a, b) => new Date(b.completed_at || b.batch_date) - new Date(a.completed_at || a.batch_date))
    .forEach(r => {
      if (map[r.sku_id] !== undefined) return;
      const sku = (skus || []).find(s => String(s.id) === String(r.sku_id));
      const mult = r.pack_type === 'monthly' ? boxesPerMonthly(sku) : 1;
      map[r.sku_id] = num(r.cost_per_unit) / mult;
      source[r.sku_id] = 'batch';
    });
  (skus || []).forEach(s => {
    if (map[s.id] !== undefined) return;
    const est = standardBoxCost(s);
    if (est != null) { map[s.id] = est; source[s.id] = 'estimate'; }
  });
  return { map, source };
}

// { [skuId]: costPerBox } — see costPerBoxInfo
export function costPerBoxMap(runs, skus) {
  return costPerBoxInfo(runs, skus).map;
}

// What one influencer has been sent, from the orders linked to them in Quick Order.
export function productsSentTo(contactId, orders, skus, costMap) {
  const mine = (orders || []).filter(o => String(o.influencer_id || '') === String(contactId) && o.status !== 'cancelled');
  return productCostOfOrders(mine, skus, costMap);
}

// Units, cost (batch cost per box) and retail value of a set of free-send orders.
export function productCostOfOrders(mine, skus, costMap) {
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
    if (id && costMap && costMap[id] !== undefined) cost += costMap[id] * u;
    else costKnown = false;
  }));
  return { orders: mine.length, units, cost, retail, costKnown };
}
