import React from 'react';
import { matchBillLine } from '../utils/billItemMatch';

// Which stock item a recipe line (or packaging line) uses — the link batches
// take stock by (see utils/batchRecipe.js stockIdsForLine). A recipe line can
// point at one stock item, or at "any grade" of a product (the batch then
// uses whatever grade is in stock, oldest first).
//
// Select values: 'id:<ingredient id>' | 'any:<product>' | '' (not linked).

export const stockLinkValue = (row) =>
  row?.stockItemId ? `id:${row.stockItemId}`
    : row?.stockProduct && row?.stockGrade === '*' ? `any:${row.stockProduct}` : '';

// The fields stored on the recipe line for a select value.
export function stockLinkFields(value, ingredients) {
  if (value && value.startsWith('id:')) {
    const item = (ingredients || []).find(i => i.id === value.slice(3));
    return { stockItemId: value.slice(3), stockProduct: item?.product || null, stockGrade: item?.grade || null };
  }
  if (value && value.startsWith('any:')) return { stockItemId: null, stockProduct: value.slice(4), stockGrade: '*' };
  return { stockItemId: null, stockProduct: null, stockGrade: null };
}

// Suggest the stock item for a vendor price-list ingredient, using the same
// rules as reading a bill. A product with several grades isn't guessed.
export function suggestStockLink(name, vendorName, ingredients) {
  if (!name) return '';
  const m = matchBillLine(name, vendorName, ingredients || [], []);
  return m.match === 'exact' || m.match === 'remembered' ? `id:${m.itemId}` : '';
}

export default function StockLinkSelect({ value, ingredients, onChange, className = '' }) {
  const byProduct = {};
  (ingredients || []).forEach(i => { const p = i.product || i.name; (byProduct[p] = byProduct[p] || []).push(i); });
  const products = Object.keys(byProduct).sort((a, b) => a.localeCompare(b));
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
      className={`${className} ${value ? '' : 'border-amber-500 ring-1 ring-amber-300'}`}>
      <option value="">Not linked to stock: choose…</option>
      {products.map(p => byProduct[p].length > 1 ? (
        <optgroup key={p} label={p}>
          <option value={`any:${p}`}>{p} (any grade)</option>
          {byProduct[p].map(i => <option key={i.id} value={`id:${i.id}`}>{i.name}</option>)}
        </optgroup>
      ) : (
        <option key={p} value={`id:${byProduct[p][0].id}`}>{byProduct[p][0].name}</option>
      ))}
    </select>
  );
}

// Packaging line -> the packaging item its stock comes out of.
export function PackagingLinkSelect({ pkg, materials, onPick, className = '' }) {
  return (
    <select value={pkg.packagingId || ''} title="Packaging item in stock"
      onChange={e => {
        const m = (materials || []).find(x => x.id === e.target.value);
        onPick({
          packagingId: e.target.value || undefined,
          ...(m && !String(pkg.name || '').trim() ? { name: m.name } : {}),
          ...(m && !pkg.price_per_unit ? { price_per_unit: m.cost_per_unit } : {}),
        });
      }}
      className={`${className} ${pkg.packagingId ? '' : 'border-amber-500'}`}>
      <option value="">Stock item…</option>
      {(materials || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}
