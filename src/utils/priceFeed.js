// Every supplier bill as a price record, shaped like a purchase order
// ({ vendor_name, order_date, po_number, items: [{ ingredient_name, product, unit_price }] })
// so Price Watch and Cost Impact see Quick Bill bills, not only purchase orders.
//
// Built from the stock lots each bill created (one lot per bill line, linked
// to its expense for the vendor and bill number). Left out: lots from
// purchase orders (already counted from the PO itself), shelf-count
// adjustments (COUNT-…, not a purchase) and lots voided to 0.
// The price is per kg as the lot holds it (Quick Bill lots include GST).
export function billPriceFeed(ingredients, expenses) {
  const expById = Object.fromEntries((expenses || []).map(e => [e.id, e]));
  const byBill = {};
  (ingredients || []).forEach(ing => (ing.ingredient_batches || []).forEach(lot => {
    const price = parseFloat(lot.price_per_unit) || 0;
    if (price <= 0 || !lot.expense_id) return;
    if (/^(PO-|COUNT-)/.test(lot.batch_number || '')) return;
    if (!(parseFloat(lot.quantity_initial) > 0)) return;
    const exp = expById[lot.expense_id];
    const bill = byBill[lot.expense_id] || (byBill[lot.expense_id] = {
      vendor_name: exp?.vendor_name || 'Unknown vendor',
      order_date: lot.received_date ? String(lot.received_date).slice(0, 10) : (exp?.bill_date || ''),
      po_number: exp?.bill_number || 'Bill',
      items: [],
      fromBill: true,
    });
    bill.items.push({ ingredient_name: ing.name, product: ing.product || null, unit_price: price });
  }));
  return Object.values(byBill);
}
