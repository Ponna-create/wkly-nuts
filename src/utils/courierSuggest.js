// Courier cost and parcel weight for a slip that has just been scanned.
//
// The slip reader misreads amounts (₹60,620 was saved once), so nothing it
// reads is saved without her checking it. Each confirmed slip
// (courier_confirmed_at) teaches the suggestions: once CONFIRMED_NEEDED slips
// are confirmed, cost comes from past slips of the same weight (same state
// first) and weight from past parcels with the same items.
import { expectedWeightForOrder } from './ocrMatch';

export const CONFIRMED_NEEDED = 20;
export const MAX_COURIER_COST = 500; // more than this on one slip is a misread

const num = (v) => parseFloat(v) || 0;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const band = (kg) => Math.ceil(kg * 2) / 2; // 0.5 kg steps, like courier rate cards
const stateOf = (o) => String(o.shipping_state || '').trim().toLowerCase();
const itemsKey = (o) => (o.items || [])
  .map(i => `${i.sku_id || i.skuId}:${i.pack_type || i.packType || ''}:${i.quantity}`)
  .sort().join('|');

// Confirmed slips only: { weight, cost, state, items }
export function courierHistory(orders) {
  return (orders || [])
    .filter(o => o.courier_confirmed_at && num(o.courier_amount) > 0 && num(o.shipping_weight) > 0)
    .map(o => ({ weight: num(o.shipping_weight), cost: num(o.courier_amount), state: stateOf(o), items: itemsKey(o) }));
}

// { weight, weightFrom, cost, costFrom } — any of them may be null.
// slipRead: { weight, amount } as the slip reader saw them (may be wrong).
export function suggestCourier(order, history, skus, slipRead = {}) {
  const learnt = history.length >= CONFIRMED_NEEDED;
  let weight = null; let weightFrom = null;
  if (learnt) {
    const same = history.filter(h => h.items === itemsKey(order));
    if (same.length >= 2) { weight = median(same.map(h => h.weight)); weightFrom = `${same.length} past parcels with the same items`; }
  }
  if (weight == null) {
    const w = expectedWeightForOrder(order, skus);
    if (w) { weight = Math.round(w * 100) / 100; weightFrom = 'product shipping weights'; }
  }
  const readW = num(slipRead.weight);
  if (weight == null && readW > 0 && readW <= 30) { weight = readW; weightFrom = 'read from the slip'; }

  let cost = null; let costFrom = null;
  if (learnt && weight) {
    const b = band(weight);
    const sameBand = history.filter(h => band(h.weight) === b);
    const sameState = sameBand.filter(h => h.state && h.state === stateOf(order));
    const pool = sameState.length >= 3 ? sameState : sameBand;
    if (pool.length >= 3) {
      cost = Math.round(median(pool.map(h => h.cost)));
      costFrom = `${pool.length} past slips up to ${b} kg${pool === sameState ? ` to ${order.shipping_state}` : ''}`;
    }
  }
  const readA = num(slipRead.amount);
  if (cost == null && readA > 0 && readA <= MAX_COURIER_COST) { cost = readA; costFrom = 'read from the slip, please check'; }
  return { weight, weightFrom, cost, costFrom };
}
