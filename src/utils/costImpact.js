// Cost of one box of each product now, 3 and 6 months ago (latest bill prices
// on each date + today's packing and labour from SKUs), what it actually sold
// for per box in the last 90 days without GST, and which raw materials moved.
// Used by Raw Purchases → Cost Impact.
import { packagingAndProcess, billRateAt } from './productCost';
import { stockIdsForLine } from './batchRecipe';
import { boxesForPacks } from './packSize';
import { isPromotionalOrder } from './invoiceFromOrder';

const num = (v) => parseFloat(v) || 0;
export const inr = (v) => (v == null ? '—' : `₹${(Math.round(v * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const inr0 = (v) => (v == null ? '—' : `₹${Math.round(v).toLocaleString('en-IN')}`);
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export const back = (months) => { const d = new Date(); d.setMonth(d.getMonth() - months); return d.toISOString().slice(0, 10); };

// recipe lines of one box, the same grams added up across the week
function recipeLines(sku) {
  const wp = sku?.weeklyPack || sku?.weekly_pack || {};
  const type = sku?.skuType || wp.skuType || 'weekly';
  const rows = type === 'weekly'
    ? DAYS.flatMap(d => (sku?.recipes?.[d] || []).map(i => ({ item: i, grams: num(i.gramsPerSachet || i.quantityPerSachet) })))
    : type === 'single' ? (sku?.singleUnitIngredients || wp.singleUnitIngredients || []).map(i => ({ item: i, grams: num(i.gramsPerUnit) })) : [];
  const byName = {};
  rows.forEach(({ item, grams }) => {
    if (!grams) return;
    const name = (item.ingredientName || item.ingredient_name || '').trim();
    const k = `${item.stockItemId || ''}|${item.stockProduct || ''}|${item.stockGrade || ''}|${name.toLowerCase()}`;
    byName[k] = byName[k] || { item, name, grams: 0 };
    byName[k].grams += grams;
  });
  return Object.values(byName);
}


export function computeCostImpact({ skus = [], ingredients = [], orders = [], dates }) {
  // what each product actually sold for per box in the last 90 days, without GST
  const soldAt = (() => {
    const since = back(3);
    const m = {};
    orders.filter(o => String(o.order_date || '').slice(0, 10) >= since && !['cancelled', 'returned'].includes(o.status) && !isPromotionalOrder(o))
      .forEach(o => (o.items || []).forEach(it => {
        const id = it.sku_id || it.skuId;
        const sku = skus.find(s => String(s.id) === String(id));
        if (!sku) return;
        const boxes = boxesForPacks(sku, it.pack_type || it.packType, it.quantity);
        const total = num(it.total) || num(it.unit_price || it.unitPrice) * num(it.quantity);
        if (boxes <= 0 || total <= 0) return;
        const gst = num(sku.gstRate ?? 5);
        m[id] = m[id] || { boxes: 0, ex: 0 };
        m[id].boxes += boxes;
        m[id].ex += total / (1 + gst / 100);
      }));
    return m;
  })();

  return skus.map(sku => {
    const lines = recipeLines(sku).map(l => {
      const ids = stockIdsForLine({ stock_item_id: l.item.stockItemId, stock_product: l.item.stockProduct, stock_grade: l.item.stockGrade, ingredient_name: l.name }, ingredients);
      const at = (d) => { const r = billRateAt(ids, ingredients, d); return r != null ? r : (num(l.item.pricePerGram) > 0 ? num(l.item.pricePerGram) * 1000 : null); };
      const fromBill = billRateAt(ids, ingredients, dates.now) != null;
      const kgNow = at(dates.now), kg3 = at(dates.m3), kg6 = at(dates.m6);
      return {
        name: l.name, grams: l.grams, fromBill, kgNow, kg3,
        now: kgNow != null ? (l.grams / 1000) * kgNow : 0,
        was3: kg3 != null ? (l.grams / 1000) * kg3 : 0,
        was6: kg6 != null ? (l.grams / 1000) * kg6 : 0,
      };
    });
    if (lines.length === 0) return null;
    const pack = packagingAndProcess(sku);
    const ingNow = lines.reduce((t, l) => t + l.now, 0);
    const ing3 = lines.reduce((t, l) => t + l.was3, 0);
    const ing6 = lines.reduce((t, l) => t + l.was6, 0);
    const s = soldAt[sku.id];
    const typed = num(sku.sellingPrice || sku.weeklyPack?.sellingPrice);
    const price = s && s.boxes > 0 ? s.ex / s.boxes : (typed > 0 ? typed / (1 + num(sku.gstRate ?? 5) / 100) : null);
    const boxNow = ingNow + pack;
    return {
      sku, lines: lines.sort((a, b) => (b.now - b.was3) - (a.now - a.was3) || b.now - a.now), pack, ingNow, ing3, ing6,
      boxNow, box3: ing3 + pack, box6: ing6 + pack, price, priceFrom: s ? `${Math.round(s.boxes)} boxes sold in 90 days` : typed > 0 ? 'typed price' : null,
      left: price != null ? price - boxNow : null, margin: price ? ((price - boxNow) / price) * 100 : null,
      notFromBills: lines.filter(l => !l.fromBill).map(l => l.name),
    };
  }).filter(Boolean).sort((a, b) => (b.boxNow - b.box3) - (a.boxNow - a.box3));
}
