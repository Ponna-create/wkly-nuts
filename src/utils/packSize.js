// How many "boxes" (one run of the product's recipe) a Monthly pack contains.
//
// A product sold as BOTH Weekly and Monthly follows the original model: the
// Monthly pack is 4 of its weekly boxes. A product marked "Monthly pack only"
// is different: its Monthly pack IS the product (for example a 7-pouch combo
// that lasts 28 days, or Seed Cycle), so one pack uses its recipe once.
export const BOXES_PER_MONTHLY_WHEN_BOTH = 4;

export function boxesPerMonthly(sku) {
  return sku && sku.soldAs === 'monthly' ? 1 : BOXES_PER_MONTHLY_WHEN_BOTH;
}

// quantity of packs -> number of recipe boxes
export function boxesForPacks(sku, packType, quantity) {
  const q = parseFloat(quantity) || 0;
  return packType === 'monthly' ? q * boxesPerMonthly(sku) : q;
}
