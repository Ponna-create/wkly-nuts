// Shared per-unit COGS estimate for a sales-order line item, using each SKU's own
// saved cost config (packaging + raw material/bulk/buy price). Used by Marketing's
// Channel Performance and the Omni Channels page so the two stay consistent.
// Approximate on purpose: combo/gift items with no clean SKU match cost ₹0 rather
// than a guess.

// Weighted-average ₹/kg across a set of ingredient_batches (whichever ingredient(s)
// they belong to) — the locked costing decision (see ProductionRuns.jsx). Blends
// whatever's actually still in stock, weighted by remaining quantity, rather than
// "last invoice price" or a stale one-off snapshot.
function weightedAverageRate(batches) {
  const list = batches || [];
  const totalQty = list.reduce((s, b) => s + (parseFloat(b.quantity_remaining) || 0), 0);
  if (totalQty <= 0) return 0;
  const totalValue = list.reduce((s, b) => s + ((parseFloat(b.quantity_remaining) || 0) * (parseFloat(b.price_per_unit) || 0)), 0);
  return totalValue / totalQty;
}

// Resolves a recipe's ingredient name to a live ₹/kg rate. Tries an exact match
// against the real ingredient stock list first (case handles a recipe that already
// names the specific graded ingredient, e.g. "Almonds Premium"). If that fails,
// falls back to ingredient_aliases — a generic recipe name ("Almonds") mapped to
// one or more specific graded ingredients ("Almonds Premium", "Almonds Regular")
// — and blends across ALL of them together, weighted by remaining quantity, so
// cost reflects whichever grade(s) are actually in stock right now rather than
// locking to one. Returns 0 with matched:false when neither resolves, so the
// caller can flag "not mapped yet" instead of silently treating it as free.
export function resolveIngredientRate(ingredientName, ingredients, aliases) {
  const exact = (ingredients || []).find(i => i.name === ingredientName);
  if (exact) return { rate: weightedAverageRate(exact.ingredient_batches), matched: true };

  const mappedIds = (aliases || []).filter(a => a.alias_name === ingredientName).map(a => a.ingredient_id);
  if (mappedIds.length === 0) return { rate: 0, matched: false };
  const batches = mappedIds.flatMap(id => {
    const ing = (ingredients || []).find(i => String(i.id) === String(id));
    return ing?.ingredient_batches || [];
  });
  return { rate: weightedAverageRate(batches), matched: true };
}

// Back-compat single-ingredient lookup (still used by ProductionRuns.jsx, where
// she picks the specific graded ingredient from a dropdown, so aliasing doesn't
// come into play — exact match only).
export function getIngredientRatePerKg(ingredientName, ingredients) {
  return resolveIngredientRate(ingredientName, ingredients).rate;
}

// Live raw-material cost for a Recipe Pack ('weekly') or 'single' SKU — recalculated
// from today's ingredient rates (via aliases where the recipe uses a generic name)
// instead of the frozen number saved whenever the recipe was last edited.
// 'repack'/'resale' aren't ingredient-batch based (bulkPrice/buyPrice are already
// live manual inputs), so they're left to the caller's existing stored-value logic.
// Returns { cost, unmatched } — `unmatched` lists ingredient names that resolved to
// neither a real ingredient nor an alias, so a stale ₹0 never passes as "accurate".
export function liveRawMaterialCost(sku, ingredients, aliases, packType = 'weekly') {
  const unmatched = new Set();
  const rateOf = (name) => {
    const { rate, matched } = resolveIngredientRate(name, ingredients, aliases);
    if (!matched && name) unmatched.add(name);
    return rate;
  };

  if (sku.skuType === 'single') {
    const cost = (sku.singleUnitIngredients || []).reduce((s, i) =>
      s + ((parseFloat(i.gramsPerUnit) || 0) / 1000) * rateOf(i.ingredientName), 0);
    return { cost, unmatched: [...unmatched] };
  }
  // Recipe Pack: sum every day's grams-per-sachet at today's rate, weekly = 7 days,
  // monthly = 4x weekly (established box model, see docs/ARCHITECTURE.md §8.3).
  const days = Object.values(sku.recipes || {});
  const weekly = days.reduce((sum, dayItems) =>
    sum + (dayItems || []).reduce((s, item) =>
      s + ((parseFloat(item.gramsPerSachet) || 0) / 1000) * rateOf(item.ingredientName), 0), 0);
  return { cost: packType === 'monthly' ? weekly * 4 : weekly, unmatched: [...unmatched] };
}

export const packagingCostOf = (materials) => (materials || []).reduce((sum, pkg) =>
  sum + ((parseFloat(pkg.quantity_per_pack) || 0) * (parseFloat(pkg.price_per_unit) || 0)), 0);

// Process cost — roasting gas, grinding, machine sealing, etc. Same open-ended
// list shape as packaging (name + cost_per_unit), a separate bucket from raw
// material and packaging since it's the cost of *transforming* the product,
// not a material consumed 1:1 per unit.
export const processCostOf = (costs) => (costs || []).reduce((sum, c) =>
  sum + (parseFloat(c.cost_per_unit) || 0), 0);

// `ingredients`/`aliases` (state.ingredients, state.ingredientAliases) are optional —
// when passed, 'single'/'weekly' SKUs cost at today's live weighted-average rate
// (see liveRawMaterialCost above) instead of the frozen snapshot from whenever the
// recipe was last saved. Omit them and this falls back to the old stored-value
// behavior, so existing call sites keep working unchanged until they opt in.
export function itemCost(item, skus, ingredients, aliases) {
  const name = item.sku_name || item.skuName;
  const sku = skus.find(s => String(s.id) === String(item.sku_id || item.skuId)) || skus.find(s => s.name === name);
  const qty = parseFloat(item.quantity || item.qty) || 0;
  if (!sku || qty <= 0) return 0;
  const packagingCost = packagingCostOf(sku.packagingMaterials);
  const processCost = processCostOf(sku.processCosts);

  if (sku.skuType === 'single') {
    const materialCost = ingredients
      ? liveRawMaterialCost(sku, ingredients, aliases).cost
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
  const perBox = (ingredients ? liveRawMaterialCost(sku, ingredients, aliases, 'weekly').cost : (sku.weeklyPack?.rawMaterialCost || 0))
    + packagingCost + processCost;
  return perBox * (isMonthly ? 4 : 1) * qty;
}

export function orderCost(order, skus, ingredients, aliases) {
  return (order.items || []).reduce((s, it) => s + itemCost(it, skus, ingredients, aliases), 0);
}
