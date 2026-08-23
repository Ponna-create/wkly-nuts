// Shared per-unit COGS estimate for a sales-order line item, using each SKU's own
// saved cost config (packaging + raw material/bulk/buy price). Used by Marketing's
// Channel Performance and the Omni Channels page so the two stay consistent.
// Approximate on purpose: combo/gift items with no clean SKU match cost ₹0 rather
// than a guess.

// Weighted-average ₹/kg across an ingredient's currently active (unconsumed) batches
// — the locked costing decision (see ProductionRuns.jsx). Blends whatever's actually
// still in stock, weighted by remaining quantity, rather than "last invoice price" or
// a stale one-off snapshot. Same function used by Production Runs, SKU Management's
// live cost display, and order-level COGS (Marketing/Omni Channels) — one calculation,
// no drift between pages. Falls back to 0 if the ingredient isn't found/has no stock
// so cost never silently guesses.
export function getIngredientRatePerKg(ingredientName, ingredients) {
  const ing = (ingredients || []).find(i => i.name === ingredientName);
  if (!ing) return 0;
  const batches = ing.ingredient_batches || [];
  const totalQty = batches.reduce((s, b) => s + (parseFloat(b.quantity_remaining) || 0), 0);
  if (totalQty <= 0) return 0;
  const totalValue = batches.reduce((s, b) => s + ((parseFloat(b.quantity_remaining) || 0) * (parseFloat(b.price_per_unit) || 0)), 0);
  return totalValue / totalQty;
}

// Live raw-material cost for a Recipe Pack ('weekly') or 'single' SKU — recalculated
// from today's ingredient rates instead of the frozen number saved whenever the
// recipe was last edited. 'repack'/'resale' aren't ingredient-batch based (bulkPrice/
// buyPrice are already live manual inputs), so they're left to the caller's existing
// stored-value logic.
export function liveRawMaterialCost(sku, ingredients, packType = 'weekly') {
  if (sku.skuType === 'single') {
    return (sku.singleUnitIngredients || []).reduce((s, i) =>
      s + ((parseFloat(i.gramsPerUnit) || 0) / 1000) * getIngredientRatePerKg(i.ingredientName, ingredients), 0);
  }
  // Recipe Pack: sum every day's grams-per-sachet at today's rate, weekly = 7 days,
  // monthly = 4x weekly (established box model, see docs/ARCHITECTURE.md §8.3).
  const days = Object.values(sku.recipes || {});
  const weekly = days.reduce((sum, dayItems) =>
    sum + (dayItems || []).reduce((s, item) =>
      s + ((parseFloat(item.gramsPerSachet) || 0) / 1000) * getIngredientRatePerKg(item.ingredientName, ingredients), 0), 0);
  return packType === 'monthly' ? weekly * 4 : weekly;
}

export const packagingCostOf = (materials) => (materials || []).reduce((sum, pkg) =>
  sum + ((parseFloat(pkg.quantity_per_pack) || 0) * (parseFloat(pkg.price_per_unit) || 0)), 0);

// Process cost — roasting gas, grinding, machine sealing, etc. Same open-ended
// list shape as packaging (name + cost_per_unit), a separate bucket from raw
// material and packaging since it's the cost of *transforming* the product,
// not a material consumed 1:1 per unit.
export const processCostOf = (costs) => (costs || []).reduce((sum, c) =>
  sum + (parseFloat(c.cost_per_unit) || 0), 0);

// `ingredients` (state.ingredients, with nested ingredient_batches) is optional —
// when passed, 'single'/'weekly' SKUs cost at today's live weighted-average rate
// (see liveRawMaterialCost above) instead of the frozen snapshot from whenever the
// recipe was last saved. Omit it and this falls back to the old stored-value
// behavior, so existing call sites keep working unchanged until they opt in.
export function itemCost(item, skus, ingredients) {
  const name = item.sku_name || item.skuName;
  const sku = skus.find(s => String(s.id) === String(item.sku_id || item.skuId)) || skus.find(s => s.name === name);
  const qty = parseFloat(item.quantity || item.qty) || 0;
  if (!sku || qty <= 0) return 0;
  const packagingCost = packagingCostOf(sku.packagingMaterials);
  const processCost = processCostOf(sku.processCosts);

  if (sku.skuType === 'single') {
    const materialCost = ingredients
      ? liveRawMaterialCost(sku, ingredients)
      : (sku.singleUnitIngredients || []).reduce((s, i) =>
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
  // Recipe Pack (weekly) — cost is per box; monthly = 4 boxes (established box model)
  const isMonthly = (item.pack_type || item.packType) === 'monthly';
  const perBox = (ingredients ? liveRawMaterialCost(sku, ingredients, 'weekly') : (sku.weeklyPack?.rawMaterialCost || 0))
    + packagingCost + processCost;
  return perBox * (isMonthly ? 4 : 1) * qty;
}

export function orderCost(order, skus, ingredients) {
  return (order.items || []).reduce((s, it) => s + itemCost(it, skus, ingredients), 0);
}
