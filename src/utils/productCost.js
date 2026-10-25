// Cost of products that were SENT (not sold): influencer / collab orders.
// Their cost per box comes from the most recent finished batch of each product
// (ingredients + packaging + labour), the same figure the Profit & Cost report uses.
import { boxesForPacks, boxesPerMonthly } from './packSize';

const num = (v) => parseFloat(v) || 0;

// { [skuId]: costPerBox } from finished batches that have a cost
export function costPerBoxMap(runs, skus) {
  const map = {};
  (runs || [])
    .filter(r => r.status === 'completed' && num(r.cost_per_unit) > 0)
    .sort((a, b) => new Date(b.completed_at || b.batch_date) - new Date(a.completed_at || a.batch_date))
    .forEach(r => {
      if (map[r.sku_id] !== undefined) return;
      const sku = (skus || []).find(s => String(s.id) === String(r.sku_id));
      const mult = r.pack_type === 'monthly' ? boxesPerMonthly(sku) : 1;
      map[r.sku_id] = num(r.cost_per_unit) / mult;
    });
  return map;
}

// What one influencer has been sent, from the orders linked to them in Quick Order.
export function productsSentTo(contactId, orders, skus, costMap) {
  const mine = (orders || []).filter(o => String(o.influencer_id || '') === String(contactId) && o.status !== 'cancelled');
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
