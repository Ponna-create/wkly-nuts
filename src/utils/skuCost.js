// Shared per-unit COGS estimate for a sales-order line item, using each SKU's own
// saved cost config (packaging + raw material/bulk/buy price). Used by Marketing's
// Channel Performance and the Omni Channels page so the two stay consistent.
// Approximate on purpose: combo/gift items with no clean SKU match cost ₹0 rather
// than a guess.

export const packagingCostOf = (materials) => (materials || []).reduce((sum, pkg) =>
  sum + ((parseFloat(pkg.quantity_per_pack) || 0) * (parseFloat(pkg.price_per_unit) || 0)), 0);

// Process cost — roasting gas, grinding, machine sealing, etc. Same open-ended
// list shape as packaging (name + cost_per_unit), a separate bucket from raw
// material and packaging since it's the cost of *transforming* the product,
// not a material consumed 1:1 per unit.
export const processCostOf = (costs) => (costs || []).reduce((sum, c) =>
  sum + (parseFloat(c.cost_per_unit) || 0), 0);

export function itemCost(item, skus) {
  const name = item.sku_name || item.skuName;
  const sku = skus.find(s => String(s.id) === String(item.sku_id || item.skuId)) || skus.find(s => s.name === name);
  const qty = parseFloat(item.quantity || item.qty) || 0;
  if (!sku || qty <= 0) return 0;
  const packagingCost = packagingCostOf(sku.packagingMaterials);
  const processCost = processCostOf(sku.processCosts);

  if (sku.skuType === 'single') {
    const materialCost = (sku.singleUnitIngredients || []).reduce((s, i) =>
      s + ((parseFloat(i.gramsPerUnit) || 0) * (parseFloat(i.pricePerGram) || 0)), 0);
    return (materialCost + packagingCost + processCost) * qty;
  }
  if (sku.skuType === 'repack') {
    const yieldF = sku.yieldPercent ? (parseFloat(sku.yieldPercent) / 100) : 1;
    const bulkQtyG = (parseFloat(sku.bulkQty) || 0) * 1000;
    const usableG = bulkQtyG * yieldF;
    const costPerG = usableG > 0 ? (parseFloat(sku.bulkPrice) || 0) / usableG : 0;
    const packG = (parseFloat(sku.packSize) || 0) * (sku.unitOfMeasure === 'kg' ? 1000 : 1);
    return (costPerG * packG + packagingCost + processCost) * qty;
  }
  if (sku.skuType === 'resale') {
    return ((parseFloat(sku.buyPrice) || 0) + packagingCost + processCost) * qty;
  }
  // Recipe Pack (weekly) — cost is stored per box; monthly = 4 boxes (established box model)
  const perBox = (sku.weeklyPack?.rawMaterialCost || 0) + packagingCost + processCost;
  const isMonthly = (item.pack_type || item.packType) === 'monthly';
  return perBox * (isMonthly ? 4 : 1) * qty;
}

export function orderCost(order, skus) {
  return (order.items || []).reduce((s, it) => s + itemCost(it, skus), 0);
}
