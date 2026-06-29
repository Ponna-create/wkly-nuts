import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, FlaskConical, ArrowRight, IndianRupee, Package,
  Trash2, Save, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_COLORS = {
  MON: 'bg-blue-500', TUE: 'bg-purple-500', WED: 'bg-pink-500',
  THU: 'bg-orange-500', FRI: 'bg-green-500', SAT: 'bg-yellow-500', SUN: 'bg-red-500',
};

const normalize = (n) => n.toLowerCase().replace(/[^a-z]/g, '');
const fuzzyMatch = (a, b) => {
  const na = normalize(a), nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
};

export default function RecipeMaker() {
  const { state, dispatch, showToast } = useApp();
  const { vendors = [], ingredients: inventoryIngredients = [] } = state;
  const navigate = useNavigate();

  const [recipeName, setRecipeName] = useState('');
  const [recipeType, setRecipeType] = useState('uniform');
  const [targetWeight, setTargetWeight] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [dayRecipes, setDayRecipes] = useState({
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [],
  });
  const [currentDay, setCurrentDay] = useState('MON');
  const [packagingMaterials, setPackagingMaterials] = useState([]);
  const [processingIngredients, setProcessingIngredients] = useState([]);
  const [processingNotes, setProcessingNotes] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [availableIngredients, setAvailableIngredients] = useState([]);

  useEffect(() => {
    dbService.getIngredientsForProduction().then(({ data }) => setAvailableIngredients(data || []));
  }, []);

  // Get all vendor ingredients for pricing
  const vendorRates = useMemo(() => {
    const map = new Map();
    vendors.forEach(v => {
      (v.ingredients || []).forEach(ing => {
        const rate = ing.unit === 'kg' ? ing.pricePerUnit / 1000 : ing.pricePerUnit;
        const key = normalize(ing.name);
        if (!map.has(key) || rate < map.get(key).ratePerGram) {
          map.set(key, { name: ing.name, ratePerGram: rate, ratePerKg: ing.pricePerUnit, vendor: v.name });
        }
      });
    });
    return map;
  }, [vendors]);

  const getRate = (name) => {
    for (const [, val] of vendorRates) {
      if (fuzzyMatch(name, val.name)) return val;
    }
    return null;
  };

  // Calculate costs
  const costAnalysis = useMemo(() => {
    let totalGramsPerWeek = 0;
    let totalCostPerWeek = 0;

    if (recipeType === 'uniform') {
      ingredients.forEach(item => {
        const grams = parseFloat(item.grams) || 0;
        const rate = getRate(item.name);
        totalGramsPerWeek += grams * 7;
        totalCostPerWeek += grams * 7 * (rate?.ratePerGram || 0);
      });
    } else {
      DAYS.forEach(day => {
        (dayRecipes[day] || []).forEach(item => {
          const grams = parseFloat(item.grams) || 0;
          const rate = getRate(item.name);
          totalGramsPerWeek += grams;
          totalCostPerWeek += grams * (rate?.ratePerGram || 0);
        });
      });
    }

    // Processing ingredients cost
    let processingCost = 0;
    processingIngredients.forEach(item => {
      const rate = getRate(item.name);
      const qty = parseFloat(item.quantity) || 0;
      if (rate && item.unit === 'g') processingCost += qty * rate.ratePerGram;
      else if (rate && item.unit === 'ml') processingCost += qty * rate.ratePerGram;
    });

    const costPerPack = totalCostPerWeek + processingCost;
    const costPerSachet = costPerPack / 7;
    const sp = parseFloat(sellingPrice) || 0;
    const margin = sp > 0 ? ((sp - costPerPack) / sp * 100) : 0;

    return {
      totalGramsPerWeek,
      totalCostPerWeek,
      processingCost,
      costPerPack,
      costPerSachet,
      sellingPrice: sp,
      margin,
      profit: sp > 0 ? sp - costPerPack : 0,
    };
  }, [ingredients, dayRecipes, recipeType, processingIngredients, sellingPrice, vendorRates]);

  const currentDayWeight = useMemo(() => {
    if (recipeType === 'uniform') {
      return ingredients.reduce((s, i) => s + (parseFloat(i.grams) || 0), 0);
    }
    return (dayRecipes[currentDay] || []).reduce((s, i) => s + (parseFloat(i.grams) || 0), 0);
  }, [ingredients, dayRecipes, currentDay, recipeType]);

  const addIngredient = () => {
    if (recipeType === 'uniform') {
      setIngredients(prev => [...prev, { name: '', grams: '' }]);
    } else {
      setDayRecipes(prev => ({
        ...prev,
        [currentDay]: [...prev[currentDay], { name: '', grams: '' }],
      }));
    }
  };

  const updateIngredient = (idx, field, val) => {
    if (recipeType === 'uniform') {
      setIngredients(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    } else {
      setDayRecipes(prev => ({
        ...prev,
        [currentDay]: prev[currentDay].map((item, i) => i === idx ? { ...item, [field]: val } : item),
      }));
    }
  };

  const removeIngredient = (idx) => {
    if (recipeType === 'uniform') {
      setIngredients(prev => prev.filter((_, i) => i !== idx));
    } else {
      setDayRecipes(prev => ({
        ...prev,
        [currentDay]: prev[currentDay].filter((_, i) => i !== idx),
      }));
    }
  };

  const currentIngredients = recipeType === 'uniform' ? ingredients : (dayRecipes[currentDay] || []);

  const handleConvertToSKU = () => {
    if (!recipeName.trim()) {
      showToast('Please give your recipe a name first', 'error');
      return;
    }
    setShowConvertModal(true);
  };

  const confirmConvertToSKU = (skuCode) => {
    // Build 7-day recipes for SKU format
    const recipes = {};
    if (recipeType === 'uniform') {
      DAYS.forEach(day => {
        recipes[day] = ingredients.filter(i => i.name && i.grams).map(item => {
          const rate = getRate(item.name);
          const tw = parseFloat(targetWeight) || 0;
          const grams = parseFloat(item.grams) || 0;
          return {
            id: Date.now() + Math.random(),
            ingredientName: item.name,
            gramsPerSachet: grams,
            percentage: tw > 0 ? ((grams / tw) * 100).toFixed(1) : '0',
            pricePerGram: rate?.ratePerGram || 0,
            vendorName: rate?.vendor || '',
          };
        });
      });
    } else {
      DAYS.forEach(day => {
        recipes[day] = (dayRecipes[day] || []).filter(i => i.name && i.grams).map(item => {
          const rate = getRate(item.name);
          const tw = parseFloat(targetWeight) || 0;
          const grams = parseFloat(item.grams) || 0;
          return {
            id: Date.now() + Math.random(),
            ingredientName: item.name,
            gramsPerSachet: grams,
            percentage: tw > 0 ? ((grams / tw) * 100).toFixed(1) : '0',
            pricePerGram: rate?.ratePerGram || 0,
            vendorName: rate?.vendor || '',
          };
        });
      });
    }

    const skuData = {
      id: Date.now(),
      name: recipeName,
      skuCode: skuCode || recipeName.split(' ').map(w => w[0]).join('').toUpperCase(),
      description: processingNotes || `${recipeName} - created from Recipe Maker`,
      skuType: 'weekly',
      targetWeightPerSachet: parseFloat(targetWeight) || 0,
      recipes,
      packagingMaterials,
      processingIngredients,
      processingNotes,
      shelfLifeDays: 30,
      sellingPrice: parseFloat(sellingPrice) || 0,
      weeklyPack: {
        sachets: 7,
        totalGrams: costAnalysis.totalGramsPerWeek,
        rawMaterialCost: costAnalysis.totalCostPerWeek,
        packaging: packagingMaterials,
        processingIngredients,
        processingNotes,
        sellingPrice: parseFloat(sellingPrice) || 0,
      },
      monthlyPack: {
        sachets: 28,
        weeklyPacksIncluded: 4,
        totalGrams: costAnalysis.totalGramsPerWeek * 4,
        rawMaterialCost: costAnalysis.totalCostPerWeek * 4,
        packaging: packagingMaterials,
        processingIngredients,
        processingNotes,
        sellingPrice: parseFloat(sellingPrice) || 0,
      },
    };

    dispatch({ type: 'ADD_SKU', payload: skuData });
    showToast(`"${recipeName}" saved as SKU with code ${skuData.skuCode}`, 'success');
    setShowConvertModal(false);
    navigate('/ingredients');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <FlaskConical className="w-8 h-8 text-amber-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Recipe Maker</h2>
            <p className="text-sm text-gray-600">R&D — experiment with ingredients, test costs, then convert to SKU</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recipe Builder */}
        <div className="lg:col-span-2 space-y-4">
          {/* Name & Type */}
          <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name *</label>
                <input type="text" value={recipeName} onChange={e => setRecipeName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="e.g. Seed Balls, Power Mix" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Weight / Sachet (g)</label>
                <input type="number" value={targetWeight} onChange={e => setTargetWeight(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="e.g. 30" min="1" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRecipeType('uniform')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${recipeType === 'uniform' ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' : 'bg-gray-100 text-gray-600'}`}>
                Same recipe all 7 days
              </button>
              <button onClick={() => setRecipeType('perday')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${recipeType === 'perday' ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' : 'bg-gray-100 text-gray-600'}`}>
                Different recipe per day
              </button>
            </div>
          </div>

          {/* Day Tabs (per-day mode) */}
          {recipeType === 'perday' && (
            <div className="flex gap-1.5">
              {DAYS.map(day => {
                const hasItems = (dayRecipes[day] || []).length > 0;
                return (
                  <button key={day} onClick={() => setCurrentDay(day)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition relative ${currentDay === day ? `${DAY_COLORS[day]} text-white` : hasItems ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                    {day}
                    {hasItems && currentDay !== day && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Ingredients */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {recipeType === 'perday' ? `${currentDay} Ingredients` : 'Ingredients (per sachet)'}
                </h3>
                {targetWeight && (
                  <p className={`text-xs ${Math.abs(currentDayWeight - parseFloat(targetWeight)) < 0.5 ? 'text-green-600' : 'text-amber-600'}`}>
                    {currentDayWeight.toFixed(1)}g / {targetWeight}g target
                  </p>
                )}
              </div>
              <button onClick={addIngredient} className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium">
                <Plus className="w-4 h-4" /> Add Ingredient
              </button>
            </div>

            {currentIngredients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Add ingredients to start building your recipe</p>
            ) : (
              <div className="space-y-2">
                {currentIngredients.map((item, idx) => {
                  const rate = getRate(item.name);
                  const cost = rate ? (parseFloat(item.grams) || 0) * rate.ratePerGram : 0;
                  return (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <select value={item.name} onChange={e => updateIngredient(idx, 'name', e.target.value)}
                        className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-white">
                        <option value="">Select ingredient...</option>
                        {availableIngredients.map(ai => (
                          <option key={ai.id} value={ai.name}>{ai.name}</option>
                        ))}
                      </select>
                      <input type="number" value={item.grams} onChange={e => updateIngredient(idx, 'grams', e.target.value)}
                        className="w-20 border rounded-lg px-2 py-1.5 text-sm bg-white" placeholder="grams" min="0" step="0.5" />
                      <span className="text-xs text-gray-500 w-6">g</span>
                      {rate && cost > 0 && (
                        <span className="text-xs text-green-600 font-medium w-16 text-right">₹{cost.toFixed(2)}</span>
                      )}
                      <button onClick={() => removeIngredient(idx)} className="p-1 text-red-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Processing Ingredients */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Processing Ingredients</h3>
              <button onClick={() => setProcessingIngredients(prev => [...prev, { name: '', quantity: '', unit: 'g' }])}
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800 font-medium">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Items used during preparation but not counted in sachet weight (ghee, honey, etc.)</p>
            {processingIngredients.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <input type="text" value={item.name} onChange={e => {
                  const u = [...processingIngredients]; u[idx] = { ...u[idx], name: e.target.value }; setProcessingIngredients(u);
                }} className="flex-1 border rounded-lg px-2 py-1.5 text-sm" placeholder="e.g. Ghee, Honey" />
                <input type="number" value={item.quantity} onChange={e => {
                  const u = [...processingIngredients]; u[idx] = { ...u[idx], quantity: e.target.value }; setProcessingIngredients(u);
                }} className="w-20 border rounded-lg px-2 py-1.5 text-sm" placeholder="Qty" min="0" step="0.1" />
                <select value={item.unit} onChange={e => {
                  const u = [...processingIngredients]; u[idx] = { ...u[idx], unit: e.target.value }; setProcessingIngredients(u);
                }} className="w-16 border rounded-lg px-2 py-1.5 text-sm">
                  <option value="g">g</option><option value="ml">ml</option><option value="pcs">pcs</option>
                </select>
                <button onClick={() => setProcessingIngredients(prev => prev.filter((_, i) => i !== idx))}
                  className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          {/* Processing Notes */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Processing Steps</label>
            <textarea value={processingNotes} onChange={e => setProcessingNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" rows={2}
              placeholder="e.g. Roast flax & pumpkin seeds at 150°C for 10 min → Mix with warm honey → Form 10g balls → Air dry 30 min → Pack" />
          </div>

          {/* Packaging */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Packaging (per pack)</h3>
              <button onClick={() => setPackagingMaterials(prev => [...prev, { name: '', quantity_per_pack: '', unit: 'pcs' }])}
                className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <Plus className="w-4 h-4" /> Add Material
              </button>
            </div>
            {packagingMaterials.map((pkg, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <input type="text" value={pkg.name} onChange={e => {
                  const u = [...packagingMaterials]; u[idx] = { ...u[idx], name: e.target.value }; setPackagingMaterials(u);
                }} className="flex-1 border rounded-lg px-2 py-1.5 text-sm" placeholder="e.g. Weekly Box, Sachet 100g" />
                <input type="number" value={pkg.quantity_per_pack} onChange={e => {
                  const u = [...packagingMaterials]; u[idx] = { ...u[idx], quantity_per_pack: e.target.value }; setPackagingMaterials(u);
                }} className="w-20 border rounded-lg px-2 py-1.5 text-sm" placeholder="Qty" min="0" />
                <select value={pkg.unit} onChange={e => {
                  const u = [...packagingMaterials]; u[idx] = { ...u[idx], unit: e.target.value }; setPackagingMaterials(u);
                }} className="w-20 border rounded-lg px-2 py-1.5 text-sm">
                  <option value="pcs">pcs</option><option value="sheets">sheets</option><option value="meters">meters</option>
                </select>
                <button onClick={() => setPackagingMaterials(prev => prev.filter((_, i) => i !== idx))}
                  className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {packagingMaterials.length === 0 && (
              <p className="text-xs text-gray-400 italic">e.g. 1 weekly box, 7 sachets, 1 label sheet</p>
            )}
          </div>
        </div>

        {/* Right: Live Cost Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-4 sticky top-20">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-amber-600" /> Live Cost Analysis
            </h3>

            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-600">Raw Material / Pack</p>
                <p className="text-xl font-bold text-amber-800">
                  {costAnalysis.costPerPack > 0 ? `₹${costAnalysis.costPerPack.toFixed(2)}` : '—'}
                </p>
                <p className="text-[10px] text-amber-500">₹{costAnalysis.costPerSachet.toFixed(2)} per sachet</p>
              </div>

              {costAnalysis.processingCost > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs text-orange-600">Processing Cost / Pack</p>
                  <p className="text-lg font-bold text-orange-800">₹{costAnalysis.processingCost.toFixed(2)}</p>
                </div>
              )}

              {/* Selling Price */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Selling Price / Pack</label>
                <input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500" placeholder="e.g. 399" min="0" />
              </div>

              {costAnalysis.sellingPrice > 0 && (
                <div className={`border rounded-lg p-3 ${costAnalysis.margin > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-xs ${costAnalysis.margin > 0 ? 'text-green-600' : 'text-red-600'}`}>Margin</p>
                  <p className={`text-xl font-bold ${costAnalysis.margin > 0 ? 'text-green-800' : 'text-red-800'}`}>
                    {costAnalysis.margin.toFixed(1)}%
                  </p>
                  <p className={`text-xs ${costAnalysis.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{costAnalysis.profit.toFixed(2)} profit per pack
                  </p>
                </div>
              )}

              {/* Weight Summary */}
              <div className="bg-gray-50 border rounded-lg p-3">
                <p className="text-xs text-gray-600">Total per week</p>
                <p className="text-sm font-medium">{(costAnalysis.totalGramsPerWeek / 1000).toFixed(3)} kg</p>
              </div>

              {/* Ingredient Cost Breakdown */}
              {currentIngredients.filter(i => i.name).length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Per Sachet Breakdown</p>
                  <div className="space-y-1">
                    {currentIngredients.filter(i => i.name).map((item, idx) => {
                      const rate = getRate(item.name);
                      const grams = parseFloat(item.grams) || 0;
                      const cost = rate ? grams * rate.ratePerGram : 0;
                      return (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-gray-600">{item.name} ({grams}g)</span>
                          <span className="font-medium">{cost > 0 ? `₹${cost.toFixed(2)}` : '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Convert to SKU button */}
            <button onClick={handleConvertToSKU}
              disabled={currentIngredients.filter(i => i.name && i.grams).length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition">
              <Package className="w-4 h-4" /> Convert to SKU
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Convert to SKU Modal */}
      {showConvertModal && <ConvertModal
        recipeName={recipeName}
        onConfirm={confirmConvertToSKU}
        onClose={() => setShowConvertModal(false)}
      />}
    </div>
  );
}

function ConvertModal({ recipeName, onConfirm, onClose }) {
  const [skuCode, setSkuCode] = useState(
    recipeName.split(' ').map(w => w[0]).join('').toUpperCase()
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" /> Convert to SKU
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU Name</label>
            <input type="text" value={recipeName} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU Code</label>
            <input type="text" value={skuCode} onChange={e => setSkuCode(e.target.value.toUpperCase())}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500" placeholder="e.g. SB" />
            <p className="text-xs text-gray-500 mt-1">Short code used in batch numbers (e.g. SB-2026-0629-001)</p>
          </div>
          <p className="text-sm text-gray-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            This will create a new SKU with all your recipe data, packaging, and processing info. You can edit it later in SKU Management.
          </p>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={() => onConfirm(skuCode)}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
            Create SKU
          </button>
        </div>
      </div>
    </div>
  );
}
