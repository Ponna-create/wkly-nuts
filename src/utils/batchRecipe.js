// Works out what a production batch will use, from the SKU's own recipe.
// Same source and rules as the Production screen (recipes by weekday, packaging
// per pack), but returns plain data so Quick Batch can preview stock before saving.

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
import { boxesForPacks } from './packSize';

export function boxesFor(packType, quantity, sku) {
  return boxesForPacks(sku, packType, quantity);
}

export function shelfLifeFor(sku) {
  return parseInt(sku?.shelfLifeDays || sku?.weeklyPack?.shelfLifeDays || sku?.monthlyPack?.shelfLifeDays, 10) || 30;
}

// returns { ingredients: [{ ingredient_name, quantity_grams, stock_item_id, stock_product, stock_grade }],
//           packaging: [{ material_name, material_id, quantity, unit }] }
// Recipe lines linked to a stock item (or to "any grade" of a product) carry
// that link so the batch takes stock by id, not by spelling; lines are
// totalled per link, so the same item used on several weekdays is one line.
export function buildRunRecipe(sku, packType, quantity) {
  const out = { ingredients: [], packaging: [] };
  const qty = parseFloat(quantity) || 0;
  if (!sku || qty <= 0) return out;

  const lines = new Map();
  const add = (item, g) => {
    const name = (item.ingredientName || item.ingredient_name || '').trim();
    if (!name || !g) return;
    const key = item.stockItemId ? `id:${item.stockItemId}`
      : item.stockProduct && item.stockGrade === '*' ? `product:${item.stockProduct}`
      : `name:${name}`;
    const cur = lines.get(key) || {
      ingredient_name: item.stockItemId || item.stockGrade === '*' ? (item.stockGrade === '*' ? `${item.stockProduct} (any grade)` : name) : name,
      grams: 0,
      stock_item_id: item.stockItemId || null,
      stock_product: item.stockProduct || null,
      stock_grade: item.stockGrade || null,
    };
    cur.grams += g;
    lines.set(key, cur);
  };
  const isRecipePack = (sku.skuType || 'weekly') === 'weekly';

  if (isRecipePack) {
    const boxes = boxesFor(packType, qty, sku);
    const recipes = sku.recipes || {};
    DAYS.forEach(day => {
      (recipes[day] || []).forEach(item => add(item, parseFloat(item.gramsPerSachet || item.quantityPerSachet || 0) * boxes));
    });
  } else {
    (sku.singleUnitIngredients || []).forEach(item => add(item, parseFloat(item.gramsPerUnit || 0) * qty));
  }

  out.ingredients = [...lines.values()].map(({ grams, ...rest }) => ({ ...rest, quantity_grams: String(Math.round(grams)) }));

  const pack = (packType === 'monthly' ? sku.monthlyPack : sku.weeklyPack) || sku.weeklyPack || sku.monthlyPack || {};
  out.packaging = (pack.packaging || [])
    .map(p => ({
      material_name: p.material_name || p.name || '',
      material_id: p.packagingId || null,
      quantity: String((parseInt(p.quantity_per_pack, 10) || parseInt(p.quantity, 10) || 0) * qty),
      unit: p.unit || 'pcs',
    }))
    .filter(p => p.material_name && parseFloat(p.quantity) > 0);

  return out;
}

// Which stock items a batch line may take from: the linked item, every grade
// of the linked product ("any grade"), or — for an unlinked old recipe line —
// the item spelled the same, then Recipe Mapping. Used by the Quick Batch
// preview and by dbService.startProductionRun so both agree.
export function stockIdsForLine(line, ingredients, aliases) {
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (line.stock_item_id) return [line.stock_item_id];
  if (line.stock_product && line.stock_grade === '*') {
    return (ingredients || []).filter(i => i.product === line.stock_product).map(i => i.id);
  }
  const name = line.ingredient_name || line.name || '';
  const exact = (ingredients || []).filter(i => norm(i.name) === norm(name)).map(i => i.id);
  if (exact.length) return exact;
  return (aliases || []).filter(a => norm(a.alias_name) === norm(name)).map(a => a.ingredient_id);
}

export function ddmmyy(dateStr) {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + (parseInt(days, 10) || 0));
  return d.toISOString().split('T')[0];
}
