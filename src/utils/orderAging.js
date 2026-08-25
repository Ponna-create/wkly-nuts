// Flags orders that have been sitting too long in the pre-courier stages
// (Confirmed / Packing / Fulfilled) — the window where a bulk A4 print run
// can quietly leave one order behind and nothing else in the app would show
// it. Counted in *business days*, skipping Sunday, because ST Courier has no
// Sunday pickup — Saturday-night, Sunday, and Monday orders all genuinely
// wait for the same Monday collection, and that gap is normal, not stuck.

// Statuses that still need to physically leave the house before a courier
// has it — 'collected' onward means it's already in the courier's hands.
const PRE_COLLECTION_STATUSES = ['confirmed', 'packing', 'fulfilled'];

// Flag once an order has waited more than 1 full business day past its
// order date — e.g. a Friday order is expected to be gone by Monday
// (1 business day: Saturday); still sitting there Tuesday (business day 2)
// is a real miss, not the normal Sunday gap.
const STUCK_THRESHOLD_DAYS = 2;

// Business days strictly between orderDate (exclusive) and today (inclusive),
// skipping Sundays.
export function businessDaysSince(orderDateStr) {
  if (!orderDateStr) return 0;
  const start = new Date(orderDateStr);
  if (isNaN(start.getTime())) return 0;
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start >= today) return 0;

  let count = 0;
  const d = new Date(start);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    if (d.getDay() !== 0) count++; // 0 = Sunday, no courier pickup
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// { stuck: boolean, days: number } for one order.
export function getStuckInfo(order) {
  if (!order || !PRE_COLLECTION_STATUSES.includes(order.status)) {
    return { stuck: false, days: 0 };
  }
  const days = businessDaysSince(order.order_date);
  return { stuck: days >= STUCK_THRESHOLD_DAYS, days };
}

// Count of stuck orders across a list — used for the Dashboard's Pending
// Actions highlight.
export function countStuckOrders(orders) {
  return (orders || []).filter(o => getStuckInfo(o).stuck).length;
}
