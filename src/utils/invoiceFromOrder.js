// Maps a sales order onto the shape dbService.createInvoice() expects.
// `skus` (optional) is state.skus — used to attach each item's HSN code for the GST invoice.
export function buildInvoiceDataFromOrder(order, notePrefix, skus) {
  return {
    customerId: order.customer_id,
    invoiceDate: new Date().toISOString().split('T')[0],
    items: (order.items || []).map(item => {
      const skuId = item.sku_id || item.skuId;
      const sku = (skus || []).find(s => String(s.id) === String(skuId));
      return {
        skuId,
        skuName: item.sku_name || item.skuName,
        packType: item.pack_type || item.packType,
        quantity: item.quantity,
        unitPrice: item.unit_price || item.unitPrice,
        total: item.total,
        hsnCode: sku?.hsnCode || '',
      };
    }),
    gstRate: order.gst_rate || 5,
    subtotal: order.subtotal || 0,
    gstAmount: order.gst_amount || 0,
    discountPercent: order.discount_percent || 0,
    discountAmount: order.discount_amount || 0,
    shippingCharge: order.shipping_charge || 0,
    totalAmount: order.total_amount || 0,
    balanceDue: (order.total_amount || 0) - (order.amount_paid || 0),
    advancePaid: order.amount_paid || 0,
    status: order.payment_status === 'received' ? 'paid' : 'sent',
    paymentMethod: order.payment_method,
    notes: `${notePrefix} — ${order.order_number}`,
  };
}
