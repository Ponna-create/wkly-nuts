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

// returns { ingredients: [{ ingredient_name, quantity_grams }], packaging: [{ material_name, quantity, unit }] }
export function buildRunRecipe(sku, packType, quantity) {
  const out = { ingredients: [], packaging: [] };
  const qty = parseFloat(quantity) || 0;
  if (!sku || qty <= 0) return out;

  const grams = new Map();
  const isRecipePack = (sku.skuType || 'weekly') === 'weekly';

  if (isRecipePack) {
    const boxes = boxesFor(packType, qty, sku);
    const recipes = sku.recipes || {};
    DAYS.forEach(day => {
      (recipes[day] || []).forEach(item => {
        const name = item.ingredientName || item.ingredient_name || '';
        const g = parseFloat(item.gramsPerSachet || item.quantityPerSachet || 0);
        if (!name || !g) return;
        grams.set(name, (grams.get(name) || 0) + g * boxes);
      });
    });
  } else {
    (sku.singleUnitIngredients || []).forEach(item => {
      const name = item.ingredientName || item.ingredient_name || '';
      const g = parseFloat(item.gramsPerUnit || 0);
      if (!name || !g) return;
      grams.set(name, (grams.get(name) || 0) + g * qty);
    });
  }

  out.ingredients = [...grams.entries()].map(([name, g]) => ({
    ingredient_name: name,
    quantity_grams: String(Math.round(g)),
  }));

  const pack = (packType === 'monthly' ? sku.monthlyPack : sku.weeklyPack) || sku.weeklyPack || sku.monthlyPack || {};
  out.packaging = (pack.packaging || [])
    .map(p => ({
      material_name: p.material_name || p.name || '',
      quantity: String((parseInt(p.quantity_per_pack, 10) || parseInt(p.quantity, 10) || 0) * qty),
      unit: p.unit || 'pcs',
    }))
    .filter(p => p.material_name && parseFloat(p.quantity) > 0);

  return out;
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
