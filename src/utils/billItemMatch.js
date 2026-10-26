// Matches a name printed on a supplier bill to a stock item (ingredient).
//
// Order: what this vendor's wording was remembered as -> what any vendor's
// wording was remembered as -> the item with exactly that name -> the
// product the name belongs to. A product with several grades (Cashews W320 /
// W240 / A320) is never guessed: the line is marked 'grade' and Quick Bill
// asks which grade; the answer is remembered for that vendor + wording
// (bill_item_memory). Only after all of those fail does it fall back to a
// loose name match or a new item.

export const keyOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// returns { itemId, match: 'remembered' | 'exact' | 'grade' | 'loose' | 'new', product?, newName? }
export function matchBillLine(name, vendor, ingredients, memory) {
  const nk = keyOf(name);
  const vk = keyOf(vendor) || '*';
  const mem = (memory || []).find(m => m.vendor_key === vk && m.name_key === nk)
    || (memory || []).find(m => m.vendor_key === '*' && m.name_key === nk);
  if (mem && mem.ingredient_id && ingredients.some(i => i.id === mem.ingredient_id)) {
    return { itemId: mem.ingredient_id, match: 'remembered' };
  }

  const exact = ingredients.find(i => keyOf(i.name) === nk);
  if (exact) return { itemId: exact.id, match: 'exact' };

  const products = [...new Set(ingredients.map(i => i.product).filter(Boolean))];
  const product = (mem && mem.product) || products
    .filter(p => keyOf(p).length >= 4 && (nk.includes(keyOf(p)) || keyOf(p).includes(nk)))
    .sort((a, b) => keyOf(b).length - keyOf(a).length)[0];
  if (product) {
    const grades = ingredients.filter(i => i.product === product);
    if (grades.length === 1) return { itemId: grades[0].id, match: 'exact' };
    if (grades.length > 1) return { itemId: '', match: 'grade', product };
  }

  const loose = ingredients.find(i => keyOf(i.name).includes(nk) || nk.includes(keyOf(i.name)));
  if (loose) return { itemId: loose.id, match: 'loose' };
  return { itemId: '__new', match: 'new', newName: name };
}
