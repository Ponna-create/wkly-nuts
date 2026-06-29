import React, { useState, useMemo, useEffect } from 'react';
import {
  Calculator, ChevronDown, ChevronUp, Package, Plus, X,
  IndianRupee, TrendingUp, AlertTriangle, ShoppingCart, FileDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_COLORS = {
  MON: 'bg-blue-500', TUE: 'bg-purple-500', WED: 'bg-pink-500',
  THU: 'bg-orange-500', FRI: 'bg-green-500', SAT: 'bg-yellow-500', SUN: 'bg-red-500',
};

const normalize = (name) => name.toLowerCase().replace(/[^a-z]/g, '');
const fuzzyMatch = (a, b) => {
  const na = normalize(a), nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
};

export default function COGSCalculator() {
  const { state } = useApp();
  const { skus = [], vendors = [], ingredients: inventoryIngredients = [] } = state;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('sku');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [packType, setPackType] = useState('weekly');
  const [quantity, setQuantity] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [customIngredients, setCustomIngredients] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [showDayBreakdown, setShowDayBreakdown] = useState(false);

  useEffect(() => {
    dbService.getIngredientsForProduction().then(({ data }) => {
      setAvailableIngredients(data || []);
    });
  }, []);

  const selectedSKU = useMemo(() =>
    skus.find(s => String(s.id) === String(selectedSkuId)),
    [skus, selectedSkuId]
  );

  const allVendorIngredients = useMemo(() => {
    const map = new Map();
    vendors.forEach(v => {
      (v.ingredients || []).forEach(ing => {
        const key = normalize(ing.name);
        const rate = ing.unit === 'kg' ? ing.pricePerUnit / 1000 : ing.pricePerUnit;
        if (!map.has(key) || rate < map.get(key).ratePerGram) {
          map.set(key, { name: ing.name, ratePerGram: rate, ratePerKg: ing.pricePerUnit, unit: ing.unit, vendor: v.name });
        }
      });
    });
    return map;
  }, [vendors]);

  const getRate = (ingredientName) => {
    for (const [key, val] of allVendorIngredients) {
      if (fuzzyMatch(ingredientName, val.name)) return val;
    }
    if (selectedVendorId) {
      const vendor = vendors.find(v => String(v.id) === String(selectedVendorId));
      if (vendor) {
        const ing = (vendor.ingredients || []).find(i => fuzzyMatch(ingredientName, i.name));
        if (ing) {
          const rate = ing.unit === 'kg' ? ing.pricePerUnit / 1000 : ing.pricePerUnit;
          return { name: ing.name, ratePerGram: rate, ratePerKg: ing.pricePerUnit, unit: ing.unit, vendor: vendor.name };
        }
      }
    }
    return null;
  };

  const getStock = (ingredientName) => {
    const inv = inventoryIngredients.find(i => fuzzyMatch(ingredientName, i.name));
    return inv ? { stock: inv.currentStock || inv.current_stock_total || 0, unit: inv.unit || 'kg' } : null;
  };

  const results = useMemo(() => {
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return null;

    const multiplier = packType === 'weekly' ? qty : qty * 4;
    const consolidated = new Map();

    if (mode === 'sku' && selectedSKU?.recipes) {
      DAYS.forEach(day => {
        const dayRecipe = selectedSKU.recipes[day] || [];
        dayRecipe.forEach(item => {
          const grams = (item.gramsPerSachet || item.quantityPerSachet || 0) * multiplier;
          const name = item.ingredientName || item.ingredient_name;
          if (!name) return;
          const existing = consolidated.get(name);
          if (existing) {
            existing.totalGrams += grams;
          } else {
            consolidated.set(name, { name, totalGrams: grams, gramsPerSachet: item.gramsPerSachet || item.quantityPerSachet || 0 });
          }
        });
      });
    } else if (mode === 'custom') {
      customIngredients.forEach(item => {
        if (!item.name || !item.grams) return;
        const grams = parseFloat(item.grams) * multiplier * 7;
        consolidated.set(item.name, { name: item.name, totalGrams: grams, gramsPerSachet: parseFloat(item.grams) });
      });
    }

    if (consolidated.size === 0) return null;

    let totalCost = 0;
    const items = Array.from(consolidated.values()).map(item => {
      const rateInfo = getRate(item.name);
      const stockInfo = getStock(item.name);
      const cost = rateInfo ? item.totalGrams * rateInfo.ratePerGram : 0;
      totalCost += cost;
      const totalKg = item.totalGrams / 1000;
      const stockKg = stockInfo ? stockInfo.stock : 0;
      const shortageKg = Math.max(0, totalKg - stockKg);

      return {
        ...item,
        totalKg,
        ratePerKg: rateInfo?.ratePerKg || 0,
        vendor: rateInfo?.vendor || '-',
        cost,
        stockKg,
        shortageKg,
        hasShortage: shortageKg > 0,
      };
    });

    const totalSachets = multiplier * 7;
    const costPerSachet = totalSachets > 0 ? totalCost / totalSachets : 0;
    const costPerPack = qty > 0 ? totalCost / qty : 0;
    const sp = parseFloat(sellingPrice) || 0;
    const margin = sp > 0 ? ((sp - costPerPack) / sp * 100) : 0;
    const profit = sp > 0 ? (sp - costPerPack) * qty : 0;

    return { items, totalCost, totalSachets, costPerSachet, costPerPack, margin, profit, qty, sp };
  }, [mode, selectedSKU, customIngredients, quantity, packType, sellingPrice, allVendorIngredients, inventoryIngredients]);

  const dayBreakdown = useMemo(() => {
    if (!selectedSKU?.recipes || !results) return null;
    const multiplier = packType === 'weekly' ? (parseInt(quantity) || 0) : (parseInt(quantity) || 0) * 4;
    return DAYS.map(day => {
      const recipe = selectedSKU.recipes[day] || [];
      let dayCost = 0;
      const items = recipe.map(item => {
        const name = item.ingredientName || item.ingredient_name;
        const grams = item.gramsPerSachet || item.quantityPerSachet || 0;
        const rateInfo = getRate(name);
        const cost = rateInfo ? grams * rateInfo.ratePerGram : 0;
        dayCost += cost;
        return { name, grams, cost };
      });
      return { day, items, dayCost };
    });
  }, [selectedSKU, results, packType, quantity]);

  const exportCSV = () => {
    if (!results) return;
    const name = mode === 'sku' && selectedSKU ? selectedSKU.name : 'Custom-Recipe';
    const rows = [
      `COGS Calculator - ${name}`,
      `Pack Type,${packType === 'weekly' ? 'Weekly' : 'Monthly'}`,
      `Quantity,${results.qty}`,
      `Total Sachets,${results.totalSachets}`,
      '',
      'Ingredient,Need (kg),Rate/kg,Cost,In Stock (kg),Shortage (kg),Vendor',
      ...results.items.map(i =>
        `${i.name},${i.totalKg.toFixed(2)},${i.ratePerKg.toFixed(2)},${i.cost.toFixed(2)},${i.stockKg.toFixed(2)},${i.shortageKg.toFixed(2)},${i.vendor}`
      ),
      '',
      `Total Raw Material Cost,${results.totalCost.toFixed(2)}`,
      `Cost per Pack,${results.costPerPack.toFixed(2)}`,
      `Cost per Sachet,${results.costPerSachet.toFixed(2)}`,
      ...(results.sp > 0 ? [`Selling Price,${results.sp}`, `Margin,${results.margin.toFixed(1)}%`] : []),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `COGS-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const addCustomIngredient = () => setCustomIngredients(prev => [...prev, { name: '', grams: '' }]);
  const updateCustomIngredient = (idx, field, val) => setCustomIngredients(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  const removeCustomIngredient = (idx) => setCustomIngredients(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-amber-700" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">COGS Calculator</h3>
            <p className="text-xs text-gray-500">Raw material cost, sourcing needs & margin analysis</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('sku'); setCustomIngredients([]); }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${mode === 'sku' ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Package className="w-4 h-4 inline mr-1" /> Existing SKU
            </button>
            <button
              onClick={() => { setMode('custom'); setSelectedSkuId(''); }}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${mode === 'custom' ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Plus className="w-4 h-4 inline mr-1" /> New Recipe
            </button>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {mode === 'sku' && (
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">SKU</label>
                <select value={selectedSkuId} onChange={e => setSelectedSkuId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                  <option value="">Select SKU...</option>
                  {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pack Type</label>
              <select value={packType} onChange={e => setPackType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                <option value="weekly">Weekly (7)</option>
                <option value="monthly">Monthly (28)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Packs to Make</label>
              <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="e.g. 50" min="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Selling Price/Pack</label>
              <input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="e.g. 399" min="0" />
            </div>
          </div>

          {/* Custom Recipe Builder */}
          {mode === 'custom' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-800">Recipe (per sachet)</p>
                <button onClick={addCustomIngredient} className="text-xs text-amber-700 hover:text-amber-900 font-medium">+ Add Ingredient</button>
              </div>
              {customIngredients.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select value={item.name} onChange={e => updateCustomIngredient(idx, 'name', e.target.value)}
                    className="flex-1 border rounded-lg px-2 py-1.5 text-sm">
                    <option value="">Select...</option>
                    {availableIngredients.map(ai => (
                      <option key={ai.id} value={ai.name}>{ai.name}</option>
                    ))}
                  </select>
                  <input type="number" value={item.grams} onChange={e => updateCustomIngredient(idx, 'grams', e.target.value)}
                    className="w-20 border rounded-lg px-2 py-1.5 text-sm" placeholder="grams" min="0" step="0.5" />
                  <span className="text-xs text-gray-500">g</span>
                  <button onClick={() => removeCustomIngredient(idx)} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {customIngredients.length === 0 && (
                <p className="text-xs text-amber-600 italic">Add ingredients to build your test recipe</p>
              )}
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-amber-600">Raw Material Cost</p>
                  <p className="text-lg font-bold text-amber-800">
                    {results.totalCost.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600">Cost / Pack</p>
                  <p className="text-lg font-bold text-blue-800">
                    {results.costPerPack.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-blue-500">{results.costPerSachet.toFixed(2)}/sachet</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${results.margin > 0 ? 'bg-green-50 border-green-200' : results.sp > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <p className={`text-xs ${results.margin > 0 ? 'text-green-600' : results.sp > 0 ? 'text-red-600' : 'text-gray-500'}`}>Margin</p>
                  <p className={`text-lg font-bold ${results.margin > 0 ? 'text-green-800' : results.sp > 0 ? 'text-red-800' : 'text-gray-400'}`}>
                    {results.sp > 0 ? `${results.margin.toFixed(1)}%` : '-'}
                  </p>
                  {results.sp > 0 && (
                    <p className={`text-[10px] ${results.margin > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {results.profit >= 0 ? '+' : ''}{results.profit.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })} total
                    </p>
                  )}
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-purple-600">Total Sachets</p>
                  <p className="text-lg font-bold text-purple-800">{results.totalSachets}</p>
                  <p className="text-[10px] text-purple-500">{results.qty} packs</p>
                </div>
              </div>

              {/* Ingredients Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-600">
                      <th className="text-left p-2">Ingredient</th>
                      <th className="text-right p-2">Need (kg)</th>
                      <th className="text-right p-2">Rate/kg</th>
                      <th className="text-right p-2">Cost</th>
                      <th className="text-right p-2">Stock (kg)</th>
                      <th className="text-right p-2">Buy (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.items.map((item, idx) => (
                      <tr key={idx} className={`border-b ${item.hasShortage ? 'bg-red-50' : ''}`}>
                        <td className="p-2 font-medium">{item.name}</td>
                        <td className="p-2 text-right">{item.totalKg.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          {item.ratePerKg > 0 ? (
                            <span className="text-blue-700">{item.ratePerKg.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                          ) : <span className="text-gray-400">N/A</span>}
                        </td>
                        <td className="p-2 text-right font-medium">
                          {item.cost > 0 ? item.cost.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-2 text-right">{item.stockKg.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          {item.hasShortage ? (
                            <span className="text-red-600 font-bold flex items-center justify-end gap-1">
                              <AlertTriangle className="w-3 h-3" /> {item.shortageKg.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-green-600 text-xs">In stock</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-amber-50 font-semibold">
                      <td className="p-2">Total</td>
                      <td className="p-2 text-right">{results.items.reduce((s, i) => s + i.totalKg, 0).toFixed(2)}</td>
                      <td className="p-2"></td>
                      <td className="p-2 text-right text-amber-800">
                        {results.totalCost.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2"></td>
                      <td className="p-2 text-right text-red-600">
                        {results.items.reduce((s, i) => s + i.shortageKg, 0).toFixed(2)} kg
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Day Breakdown (SKU mode only) */}
              {mode === 'sku' && dayBreakdown && (
                <div>
                  <button onClick={() => setShowDayBreakdown(!showDayBreakdown)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium">
                    {showDayBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Day-by-Day Cost Breakdown
                  </button>
                  {showDayBreakdown && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-3">
                      {dayBreakdown.map(({ day, items, dayCost }) => (
                        <div key={day} className="border rounded-lg p-2 bg-gray-50">
                          <div className={`text-xs font-bold text-white px-2 py-0.5 rounded mb-1 text-center ${DAY_COLORS[day]}`}>{day}</div>
                          <div className="space-y-0.5">
                            {items.map((item, i) => (
                              <div key={i} className="flex justify-between text-[10px]">
                                <span className="truncate">{item.name}</span>
                                <span className="font-medium ml-1">{item.grams}g</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t mt-1 pt-1 text-xs font-semibold text-amber-700 text-right">
                            {dayCost > 0 ? `₹${dayCost.toFixed(2)}` : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Export */}
              <div className="flex justify-end">
                <button onClick={exportCSV}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
                  <FileDown className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>
          )}

          {/* No results hint */}
          {!results && quantity && (mode === 'sku' ? selectedSkuId : customIngredients.length > 0) && (
            <div className="text-center py-4 text-sm text-gray-400">
              {mode === 'sku' && !selectedSKU?.recipes
                ? 'This SKU has no recipes defined — set up 7-day recipes in SKU Management first'
                : 'Add ingredients with grams to see COGS breakdown'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
