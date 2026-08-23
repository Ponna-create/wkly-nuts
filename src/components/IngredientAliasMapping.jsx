import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { dbService } from '../services/supabase';
import { resolveIngredientRate } from '../utils/skuCost';

// Recipes reference ingredients by a generic name ("Almonds") but real stock is
// tracked by specific graded ingredient ("Almonds Premium", "Almonds Regular") —
// this screen maps generic name -> one or more graded ingredients, so live cost
// can blend whichever grade(s) are actually in stock. See skuCost.js and the
// ingredient_aliases table comment for the full mechanism.
export default function IngredientAliasMapping({ skus, ingredients, aliases, onSaved, showToast }) {
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState({}); // { [aliasName]: Set(ingredientId) }
  const [saving, setSaving] = useState(null);

  // Every distinct ingredient name any recipe actually references.
  const recipeNames = useMemo(() => {
    const names = new Set();
    (skus || []).forEach(sku => {
      if (sku.skuType === 'single') {
        (sku.singleUnitIngredients || []).forEach(i => i.ingredientName && names.add(i.ingredientName));
      } else {
        Object.values(sku.recipes || {}).forEach(day => (day || []).forEach(i => i.ingredientName && names.add(i.ingredientName)));
      }
    });
    return [...names].sort();
  }, [skus]);

  const rows = useMemo(() => recipeNames.map(name => {
    const { matched } = resolveIngredientRate(name, ingredients, aliases);
    const currentMapping = (aliases || []).filter(a => a.alias_name === name);
    return { name, matched, currentMapping };
  }), [recipeNames, ingredients, aliases]);

  const unmapped = rows.filter(r => !r.matched);
  const mapped = rows.filter(r => r.matched);

  // Auto-suggest: pre-check any real ingredient whose name contains every
  // word from the generic recipe name (case-insensitive) — a starting point
  // to confirm/adjust, not an auto-decision.
  const suggestFor = (name) => {
    const words = name.toLowerCase().split(/\s+/).filter(Boolean);
    return (ingredients || [])
      .filter(ing => words.every(w => ing.name.toLowerCase().includes(w)))
      .map(ing => ing.id);
  };

  const openRow = (name, existingIds) => {
    setExpanded(expanded === name ? null : name);
    if (!draft[name]) {
      const ids = existingIds.length > 0 ? existingIds : suggestFor(name);
      setDraft(prev => ({ ...prev, [name]: new Set(ids) }));
    }
  };

  const toggle = (name, id) => {
    setDraft(prev => {
      const next = new Set(prev[name] || []);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, [name]: next };
    });
  };

  const save = async (name) => {
    setSaving(name);
    const ids = [...(draft[name] || [])];
    const { error } = await dbService.setIngredientAlias(name, ids);
    setSaving(null);
    if (error) {
      showToast?.('Error saving mapping', 'error');
      return;
    }
    showToast?.(`"${name}" mapped to ${ids.length} ingredient(s)`, 'success');
    setExpanded(null);
    onSaved?.();
  };

  if (recipeNames.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No recipe ingredients found yet.</p>;
  }

  return (
    <div className="space-y-4">
      {unmapped.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">{unmapped.length} ingredient name{unmapped.length === 1 ? '' : 's'} used in recipes {unmapped.length === 1 ? "isn't" : "aren't"} mapped to real stock yet.</p>
            <p className="mt-1 text-amber-700">Live cost can't include these until mapped — map them to whichever graded ingredient(s) they actually mean.</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {unmapped.map(row => (
          <div key={row.name} className="border border-amber-300 rounded-lg overflow-hidden">
            <button
              onClick={() => openRow(row.name, row.currentMapping.map(m => m.ingredient_id))}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-left"
            >
              <span className="font-medium text-sm text-gray-900">{row.name}</span>
              <span className="flex items-center gap-1 text-xs text-amber-700">
                Not mapped
                {expanded === row.name ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            </button>
            {expanded === row.name && (
              <div className="p-3 bg-white space-y-2">
                <p className="text-xs text-gray-500">Select every graded ingredient "{row.name}" can mean — live cost will blend whichever ones currently have stock:</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {(ingredients || []).map(ing => (
                    <label key={ing.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft[row.name]?.has(ing.id) || false}
                        onChange={() => toggle(row.name, ing.id)}
                        className="rounded"
                      />
                      {ing.name}
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => save(row.name)}
                  disabled={saving === row.name || !draft[row.name] || draft[row.name].size === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-40"
                >
                  <Check className="w-4 h-4" /> {saving === row.name ? 'Saving...' : 'Save Mapping'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {mapped.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Already resolved ({mapped.length})</h4>
          <div className="space-y-1.5">
            {mapped.map(row => (
              <div key={row.name} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => openRow(row.name, row.currentMapping.map(m => m.ingredient_id))}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left text-sm"
                >
                  <span className="text-gray-900">{row.name}</span>
                  <span className="flex items-center gap-1 text-xs text-green-700">
                    {row.currentMapping.length > 0
                      ? `→ ${row.currentMapping.map(m => m.ingredients?.name).filter(Boolean).join(', ')}`
                      : 'Exact match'}
                    {expanded === row.name ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </button>
                {expanded === row.name && (
                  <div className="p-3 bg-white space-y-2">
                    <p className="text-xs text-gray-500">Adjust which graded ingredient(s) "{row.name}" maps to (leave unchecked to fall back to an exact name match if one exists):</p>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                      {(ingredients || []).map(ing => (
                        <label key={ing.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft[row.name]?.has(ing.id) || false}
                            onChange={() => toggle(row.name, ing.id)}
                            className="rounded"
                          />
                          {ing.name}
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => save(row.name)}
                      disabled={saving === row.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-40"
                    >
                      <Check className="w-4 h-4" /> {saving === row.name ? 'Saving...' : 'Save Mapping'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
