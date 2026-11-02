// Tracking number checks for courier slips, and what a parcel should weigh.
// Slips are read from the barcode only; she picks the order herself.

export const cleanTracking = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ST Courier's 11th digit is a check digit: the first 10 digits as a number,
// mod 7. All 85 delivered 11-digit numbers in our orders pass it, and every
// number the tracking check could not find fails it, so a misread is caught
// here instead of being saved and failing the daily courier check for weeks.
// All of them start with 6 too; a new series would only ask her to confirm.
const isStNumber = (n) => /^6\d{10}$/.test(n) && Number(n.slice(0, 10)) % 7 === Number(n[10]);
export const isIndiaPostNumber = (raw) => /^[A-Z]{2}\d{9}IN$/.test(cleanTracking(raw));
export function isValidTracking(raw) {
  const n = cleanTracking(raw);
  return isStNumber(n) || isIndiaPostNumber(n);
}

// Real numbers one digit away from a misread one (one extra, one missing or
// one wrong). Slips come in runs from one book, so anything sharing the most
// leading digits with numbers we already hold goes first.
export function suggestTrackingFixes(raw, knownNumbers = [], max = 3) {
  const n = cleanTracking(raw);
  if (!/^\d{10,12}$/.test(n) || isStNumber(n)) return [];
  const out = new Set();
  if (n.length === 12) {
    for (let i = 0; i < 12; i++) out.add(n.slice(0, i) + n.slice(i + 1));
  } else {
    const keep = n.length === 11 ? 1 : 0; // replace a digit, or put a missing one in
    for (let i = 0; i <= n.length - keep; i++) {
      for (let d = 0; d <= 9; d++) out.add(n.slice(0, i) + d + n.slice(i + keep));
    }
  }
  const sharedStart = (c) => knownNumbers.reduce((best, k) => {
    let j = 0;
    while (j < c.length && c[j] === k[j]) j++;
    return Math.max(best, j);
  }, 0);
  return [...out].filter(c => c !== n && isStNumber(c))
    .map(c => ({ c, shared: sharedStart(c) }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, max)
    .map(x => x.c);
}

// What the courier's scale should read for this order — sum of each item's
// SKU shipping weight (set in SKU Management; distinct from the product's
// own content weight) × quantity, using the weekly or monthly figure
// depending on that line's pack type. Returns null if any item's SKU is
// missing a shipping weight, since a partial/guessed total would be worse
// than no signal at all for telling two orders apart.
export function expectedWeightForOrder(order, skus) {
  const items = order.items || [];
  if (items.length === 0 || !skus?.length) return null;
  let total = 0;
  for (const item of items) {
    const sku = skus.find(s => String(s.id) === String(item.sku_id || item.skuId));
    const isMonthly = (item.pack_type || item.packType) === 'monthly';
    const perUnit = isMonthly ? sku?.monthlyShippingWeightKg : sku?.shippingWeightKg;
    if (perUnit == null) return null;
    total += perUnit * (item.quantity || 1);
  }
  return total;
}
