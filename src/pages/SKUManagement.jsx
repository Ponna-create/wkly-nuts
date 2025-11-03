import React, { useState } from 'react';
import { Plus, Edit, Trash2, Calculator, X, Package, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_COLORS = {
  MON: 'bg-blue-500',
  TUE: 'bg-purple-500',
  WED: 'bg-pink-500',
  THU: 'bg-orange-500',
  FRI: 'bg-green-500',
  SAT: 'bg-yellow-500',
  SUN: 'bg-red-500',
};

const DAY_COLORS_LIGHT = {
  MON: 'bg-blue-50 border-blue-200',
  TUE: 'bg-purple-50 border-purple-200',
  WED: 'bg-pink-50 border-pink-200',
  THU: 'bg-orange-50 border-orange-200',
  FRI: 'bg-green-50 border-green-200',
  SAT: 'bg-yellow-50 border-yellow-200',
  SUN: 'bg-red-50 border-red-200',
};

export default function SKUManagement() {
  const { state, dispatch, showToast } = useApp();
  const { skus, vendors } = state;
  
  const [showForm, setShowForm] = useState(false);
  const [editingSKU, setEditingSKU] = useState(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState(null);
  
  const [currentStep, setCurrentStep] = useState(1); // 1 = Basic Info, 2 = Day Recipes
  const [currentDay, setCurrentDay] = useState('MON');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetWeightPerSachet: '',
    selectedVendorId: '',
    recipes: {
      MON: [],
      TUE: [],
      WED: [],
      THU: [],
      FRI: [],
      SAT: [],
      SUN: [],
    },
  });

  const [currentRecipeItem, setCurrentRecipeItem] = useState({
    ingredientId: '',
    gramsPerSachet: '',
  });

  const [calculatorData, setCalculatorData] = useState({
    packType: 'weekly',
    numberOfPacks: '',
    selectedVendorId: '',
  });

  const [productionRequirements, setProductionRequirements] = useState(null);

  const getAllIngredients = () => {
    const ingredients = [];
    vendors.forEach((vendor) => {
      vendor.ingredients.forEach((ing) => {
        ingredients.push({
          ...ing,
          vendorId: vendor.id,
          vendorName: vendor.name,
        });
      });
    });
    return ingredients;
  };

  const getIngredientsByVendor = (vendorId) => {
    if (!vendorId) return [];
    const vendor = vendors.find(v => v.id == vendorId);
    if (!vendor) return [];
    return vendor.ingredients.map(ing => ({
      ...ing,
      vendorId: vendor.id,
      vendorName: vendor.name,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      targetWeightPerSachet: '',
      selectedVendorId: '',
      recipes: {
        MON: [],
        TUE: [],
        WED: [],
        THU: [],
        FRI: [],
        SAT: [],
        SUN: [],
      },
    });
    setCurrentRecipeItem({ ingredientId: '', gramsPerSachet: '' });
    setCurrentStep(1);
    setCurrentDay('MON');
    setEditingSKU(null);
    setShowForm(false);
  };

  const handleAddRecipeItem = () => {
    if (!currentRecipeItem.ingredientId || !currentRecipeItem.gramsPerSachet) {
      showToast('Please select ingredient and enter grams per sachet', 'error');
      return;
    }

    if (!formData.selectedVendorId) {
      showToast('Please select a vendor first', 'error');
      return;
    }

    const vendorIngredients = getIngredientsByVendor(formData.selectedVendorId);
    // Convert ingredientId to number for comparison (select returns string)
    const ingredient = vendorIngredients.find((ing) => ing.id == currentRecipeItem.ingredientId);

    if (!ingredient) {
      showToast('Ingredient not found for selected vendor', 'error');
      return;
    }

    const gramsPerSachet = parseFloat(currentRecipeItem.gramsPerSachet);
    const targetWeight = parseFloat(formData.targetWeightPerSachet);
    const percentage = targetWeight > 0 ? (gramsPerSachet / targetWeight) * 100 : 0;

    const newRecipeItem = {
      id: Date.now() + Math.random(),
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      gramsPerSachet,
      percentage: percentage.toFixed(1),
      vendorId: ingredient.vendorId,
      vendorName: ingredient.vendorName,
      pricePerGram: ingredient.pricePerUnit / (ingredient.unit === 'kg' ? 1000 : 1),
      unit: ingredient.unit,
    };

    setFormData({
      ...formData,
      recipes: {
        ...formData.recipes,
        [currentDay]: [...formData.recipes[currentDay], newRecipeItem],
      },
    });

    setCurrentRecipeItem({ ingredientId: '', gramsPerSachet: '' });
    showToast(`Ingredient added to ${currentDay} recipe`, 'success');
  };

  const handleRemoveRecipeItem = (itemId) => {
    setFormData({
      ...formData,
      recipes: {
        ...formData.recipes,
        [currentDay]: formData.recipes[currentDay].filter((item) => item.id !== itemId),
      },
    });
  };

  const getCurrentDayTotal = () => {
    return formData.recipes[currentDay].reduce((sum, item) => sum + item.gramsPerSachet, 0);
  };

  const getCompletedDays = () => {
    return DAYS.filter((day) => formData.recipes[day].length > 0);
  };

  const calculateSKUTotals = () => {
    let weeklyTotalGrams = 0;
    let weeklyRawMaterialCost = 0;

    DAYS.forEach((day) => {
      const dayRecipe = formData.recipes[day];
      dayRecipe.forEach((item) => {
        weeklyTotalGrams += item.gramsPerSachet;
        weeklyRawMaterialCost += item.gramsPerSachet * item.pricePerGram;
      });
    });

    const monthlyTotalGrams = weeklyTotalGrams * 4;
    const monthlyRawMaterialCost = weeklyRawMaterialCost * 4;

    return {
      weeklyPack: {
        sachets: 7,
        totalGrams: weeklyTotalGrams,
        rawMaterialCost: weeklyRawMaterialCost,
      },
      monthlyPack: {
        sachets: 28,
        weeklyPacksIncluded: 4,
        totalGrams: monthlyTotalGrams,
        rawMaterialCost: monthlyRawMaterialCost,
      },
    };
  };

  const handleSaveSKU = () => {
    if (!formData.name || !formData.description || !formData.targetWeightPerSachet) {
      showToast('Please fill in all basic information', 'error');
      return;
    }

    const completedDays = getCompletedDays();
    if (completedDays.length !== 7) {
      showToast(`Please complete all 7 day recipes (${completedDays.length}/7 done)`, 'error');
      return;
    }

    const totals = calculateSKUTotals();

    const skuData = {
      ...formData,
      ...totals,
      targetWeightPerSachet: parseFloat(formData.targetWeightPerSachet),
    };

    if (editingSKU) {
      dispatch({
        type: 'UPDATE_SKU',
        payload: { id: editingSKU.id, ...skuData },
      });
      showToast('SKU updated successfully', 'success');
    } else {
      dispatch({
        type: 'ADD_SKU',
        payload: { id: Date.now(), ...skuData },
      });
      showToast('SKU created successfully', 'success');
    }

    resetForm();
  };

  const handleEdit = (sku) => {
    setFormData({
      name: sku.name,
      description: sku.description,
      targetWeightPerSachet: sku.targetWeightPerSachet,
      recipes: sku.recipes,
    });
    setEditingSKU(sku);
    setShowForm(true);
    setCurrentStep(2);
  };

  const handleDelete = (skuId) => {
    if (window.confirm('Are you sure you want to delete this SKU?')) {
      dispatch({ type: 'DELETE_SKU', payload: skuId });
      showToast('SKU deleted', 'success');
    }
  };

  const handleCalculateProduction = () => {
    if (!selectedSKU || !calculatorData.numberOfPacks) {
      showToast('Please select SKU and enter number of packs', 'error');
      return;
    }

    const numberOfPacks = parseInt(calculatorData.numberOfPacks);
    const multiplier = calculatorData.packType === 'weekly' ? numberOfPacks : numberOfPacks * 4;
    const selectedVendor = calculatorData.selectedVendorId 
      ? vendors.find(v => String(v.id) === String(calculatorData.selectedVendorId))
      : null;

    // Calculate day-by-day requirements
    const dayBreakdown = {};
    const consolidatedIngredients = new Map();

    DAYS.forEach((day) => {
      const dayRecipe = selectedSKU.recipes[day];
      
      // If vendor is selected, use that vendor's pricing; otherwise use SKU recipe pricing
      dayBreakdown[day] = dayRecipe.map((item) => {
        let pricePerGram = item.pricePerGram;
        
        // If a vendor is selected, find that vendor's price for this ingredient
        if (selectedVendor) {
          const vendorIng = selectedVendor.ingredients.find(ing => ing.name === item.ingredientName);
          if (vendorIng) {
            pricePerGram = vendorIng.unit === 'kg' ? vendorIng.pricePerUnit / 1000 : vendorIng.pricePerUnit;
          }
        }
        
        return {
          ingredientName: item.ingredientName,
          gramsPerSachet: item.gramsPerSachet,
          quantity: multiplier,
          totalGrams: item.gramsPerSachet * multiplier,
          pricePerGram: pricePerGram,
          totalCost: item.gramsPerSachet * multiplier * pricePerGram,
        };
      });

      // Consolidate ingredients
      dayRecipe.forEach((item) => {
        let pricePerGram = item.pricePerGram;
        let vendorName = item.vendorName;
        
        // If vendor is selected, use that vendor's pricing
        if (selectedVendor) {
          const vendorIng = selectedVendor.ingredients.find(ing => ing.name === item.ingredientName);
          if (vendorIng) {
            pricePerGram = vendorIng.unit === 'kg' ? vendorIng.pricePerUnit / 1000 : vendorIng.pricePerUnit;
            vendorName = selectedVendor.name;
          }
        }
        
        const totalGrams = item.gramsPerSachet * multiplier;
        const totalCost = totalGrams * pricePerGram;

        if (consolidatedIngredients.has(item.ingredientName)) {
          const existing = consolidatedIngredients.get(item.ingredientName);
          consolidatedIngredients.set(item.ingredientName, {
            ...existing,
            totalGrams: existing.totalGrams + totalGrams,
            totalCost: existing.totalCost + totalCost,
            // Update pricePerGram and vendorName if vendor is selected
            pricePerGram: selectedVendor ? pricePerGram : existing.pricePerGram,
            vendorName: selectedVendor ? vendorName : existing.vendorName,
          });
        } else {
          consolidatedIngredients.set(item.ingredientName, {
            ingredientName: item.ingredientName,
            totalGrams,
            pricePerGram: pricePerGram,
            totalCost,
            vendorName: vendorName,
          });
        }
      });
    });

    // Add vendor availability info
    const requirements = Array.from(consolidatedIngredients.values()).map((req) => {
      // If vendor is selected, only check that vendor
      if (selectedVendor) {
        const vendorIng = selectedVendor.ingredients.find((ing) => ing.name === req.ingredientName);
        if (vendorIng) {
          const availableGrams = vendorIng.unit === 'kg' ? vendorIng.quantityAvailable * 1000 : vendorIng.quantityAvailable;
          const pricePerGram = vendorIng.unit === 'kg' ? vendorIng.pricePerUnit / 1000 : vendorIng.pricePerUnit;
          
          return {
            ...req,
            pricePerGram: pricePerGram,
            totalCost: req.totalGrams * pricePerGram,
            totalKg: (req.totalGrams / 1000).toFixed(2),
            available: availableGrams,
            shortage: Math.max(0, req.totalGrams - availableGrams),
            recommendedVendor: selectedVendor.name,
            hasShortage: req.totalGrams > availableGrams,
          };
        } else {
          // Ingredient not available from selected vendor
          return {
            ...req,
            totalKg: (req.totalGrams / 1000).toFixed(2),
            available: 0,
            shortage: req.totalGrams,
            recommendedVendor: 'Not Available',
            hasShortage: true,
          };
        }
      } else {
        // No vendor selected - find all vendors and recommend best one (original behavior)
        const availableVendors = [];
        vendors.forEach((vendor) => {
          const vendorIng = vendor.ingredients.find((ing) => ing.name === req.ingredientName);
          if (vendorIng) {
            const availableGrams = vendorIng.unit === 'kg' ? vendorIng.quantityAvailable * 1000 : vendorIng.quantityAvailable;
            const pricePerGram = vendorIng.unit === 'kg' ? vendorIng.pricePerUnit / 1000 : vendorIng.pricePerUnit;
            
            availableVendors.push({
              vendorName: vendor.name,
              available: availableGrams,
              pricePerGram: pricePerGram,
              quality: vendorIng.quality,
            });
          }
        });

        const bestVendor = availableVendors
          .filter((v) => v.available >= req.totalGrams)
          .sort((a, b) => a.pricePerGram - b.pricePerGram)[0];

        const recommendedVendor = bestVendor || availableVendors.sort((a, b) => b.available - a.available)[0];

        return {
          ...req,
          totalKg: (req.totalGrams / 1000).toFixed(2),
          available: recommendedVendor?.available || 0,
          shortage: Math.max(0, req.totalGrams - (recommendedVendor?.available || 0)),
          recommendedVendor: recommendedVendor?.vendorName || 'N/A',
          hasShortage: req.totalGrams > (recommendedVendor?.available || 0),
        };
      }
    });

    const totalRawMaterialCost = requirements.reduce((sum, req) => sum + req.totalCost, 0);
    const totalSachets = multiplier * 7;
    const costPerPack = totalRawMaterialCost / numberOfPacks;
    const costPerSachet = totalRawMaterialCost / totalSachets;

    setProductionRequirements({
      dayBreakdown,
      requirements,
      totalSachets,
      totalRawMaterialCost,
      costPerPack,
      costPerSachet,
      numberOfPacks,
      multiplier,
      packType: calculatorData.packType,
      selectedVendorName: selectedVendor?.name || null,
    });

    showToast('Production requirements calculated', 'success');
  };

  const exportToCSV = () => {
    if (!productionRequirements) return;

    const headers = ['Ingredient', 'Total Grams', 'Total Kg', 'Available', 'Shortage', 'Cost/Gram', 'Total Cost', 'Vendor'];
    const rows = productionRequirements.requirements.map(req => [
      req.ingredientName,
      req.totalGrams.toFixed(0),
      req.totalKg,
      req.available.toFixed(0),
      req.shortage.toFixed(0),
      req.pricePerGram.toFixed(2),
      req.totalCost.toFixed(2),
      req.recommendedVendor,
    ]);

    const csvContent = [
      `Production Requirements - ${selectedSKU.name}`,
      `Pack Type: ${productionRequirements.packType === 'weekly' ? 'Weekly' : 'Monthly'}`,
      `Packs to Produce: ${productionRequirements.numberOfPacks}`,
      ...(productionRequirements.selectedVendorName ? [`Vendor Used: ${productionRequirements.selectedVendorName}`] : ['Vendor: Auto-selected (best price/availability)']),
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      `Total Raw Material Cost,₹${productionRequirements.totalRawMaterialCost.toFixed(2)}`,
      `Cost Per Pack,₹${productionRequirements.costPerPack.toFixed(2)}`,
      `Cost Per Sachet,₹${productionRequirements.costPerSachet.toFixed(2)}`,
      `Total Sachets,${productionRequirements.totalSachets}`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-${selectedSKU.name}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('CSV exported successfully', 'success');
  };

  const currentDayTotal = getCurrentDayTotal();
  const targetWeight = parseFloat(formData.targetWeightPerSachet) || 0;
  const completedDays = getCompletedDays();
  const allIngredients = getAllIngredients();

  const getWeightStatus = () => {
    if (targetWeight === 0) return 'gray';
    const diff = Math.abs(currentDayTotal - targetWeight);
    if (diff === 0) return 'green';
    if (diff <= 2) return 'yellow';
    return 'red';
  };

  const weightStatus = getWeightStatus();
  const weightStatusColors = {
    green: 'bg-green-100 text-green-800 border-green-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    gray: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SKU Management</h1>
          <p className="text-gray-600 mt-1">Create products with 7-day unique recipes</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowCalculator(true);
              setShowForm(false);
            }}
            className="btn-accent flex items-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Production Calculator
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setShowCalculator(false);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create SKU
          </button>
        </div>
      </div>

      {/* SKU Form */}
      {showForm && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editingSKU ? 'Edit SKU' : 'Create New SKU'}
            </h2>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${currentStep === 1 ? 'bg-primary' : 'bg-green-500'}`}>
                {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <div className="flex-1 h-1 bg-gray-200">
                <div className={`h-full ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-200'}`} style={{ width: currentStep > 1 ? '100%' : '0%' }}></div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${currentStep === 2 ? 'bg-primary' : 'bg-gray-300'}`}>
                2
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className={currentStep === 1 ? 'text-primary font-semibold' : 'text-gray-600'}>Basic Info</span>
              <span className={currentStep === 2 ? 'text-primary font-semibold' : 'text-gray-600'}>7-Day Recipes ({completedDays.length}/7)</span>
            </div>
          </div>

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">SKU Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Day Pack, Night Pack"
                  />
                </div>
                <div>
                  <label className="label">Target Weight per Sachet (grams) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    value={formData.targetWeightPerSachet}
                    onChange={(e) => setFormData({ ...formData, targetWeightPerSachet: e.target.value })}
                    className="input-field"
                    placeholder="e.g., 30 or 44"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Select Vendor for All Ingredients <span className="text-red-500">*</span></label>
                  <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
                    <select
                      value={formData.selectedVendorId}
                      onChange={(e) => setFormData({ ...formData, selectedVendorId: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="input-field"
                      style={{ 
                        zIndex: 99999, 
                        position: 'relative',
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={String(vendor.id)}>
                          {vendor.name} ({vendor.ingredients.length} ingredients)
                        </option>
                      ))}
                    </select>
                  </div>
                  {formData.selectedVendorId && (
                    <p className="text-sm text-gray-600 mt-1">
                      Selected vendor will be used for all recipe ingredients
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="label">Description <span className="text-red-500">*</span></label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows="3"
                    placeholder="Product description"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (!formData.name || !formData.description || !formData.targetWeightPerSachet || !formData.selectedVendorId) {
                      showToast('Please fill in all required fields including vendor selection', 'error');
                      return;
                    }
                    setCurrentStep(2);
                  }}
                  className="btn-primary"
                >
                  Next: Build Day Recipes
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Day Recipes */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Day Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setCurrentDay(day)}
                    className={`px-4 py-2 rounded-lg font-semibold text-white whitespace-nowrap transition-all relative ${
                      currentDay === day ? DAY_COLORS[day] + ' scale-105' : DAY_COLORS[day] + ' opacity-50'
                    }`}
                  >
                    {day}
                    {formData.recipes[day].length > 0 && (
                      <Check className="w-4 h-4 absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5" />
                    )}
                  </button>
                ))}
              </div>

              {/* Current Day Recipe Builder */}
              <div className={`p-6 rounded-lg border-2 ${DAY_COLORS_LIGHT[currentDay]}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{currentDay} Recipe</h3>
                  <div className={`px-4 py-2 rounded-lg border-2 ${weightStatusColors[weightStatus]}`}>
                    <span className="font-bold">{currentDayTotal}g</span> / {targetWeight}g
                  </div>
                </div>

                {/* Added Recipe Items */}
                {formData.recipes[currentDay].length > 0 && (
                  <div className="mb-4 space-y-2">
                    {formData.recipes[currentDay].map((item) => (
                      <div key={item.id} className="bg-white p-3 rounded-lg flex justify-between items-center shadow-sm">
                        <div className="flex-1">
                          <span className="font-semibold text-gray-900">{item.ingredientName}</span>
                          <span className="text-sm text-gray-600 ml-3">
                            {item.gramsPerSachet}g ({item.percentage}%)
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveRecipeItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Vendor Info */}
                {formData.selectedVendorId && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-4">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Selected Vendor:</span> {vendors.find(v => v.id == formData.selectedVendorId)?.name}
                      <span className="ml-2 text-blue-600">
                        ({getIngredientsByVendor(formData.selectedVendorId).length} ingredients available)
                      </span>
                    </p>
                  </div>
                )}

                {/* Add Ingredient Form */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div className="md:col-span-2">
                      <label className="label text-sm">Ingredient</label>
                      <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
                        <select
                          value={currentRecipeItem.ingredientId}
                          onChange={(e) => setCurrentRecipeItem({ ...currentRecipeItem, ingredientId: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="input-field"
                          disabled={!formData.selectedVendorId}
                          style={{ 
                            zIndex: 99999, 
                            position: 'relative',
                            pointerEvents: formData.selectedVendorId ? 'auto' : 'none',
                            cursor: formData.selectedVendorId ? 'pointer' : 'not-allowed'
                          }}
                        >
                          <option value="">-- Select Ingredient --</option>
                          {getIngredientsByVendor(formData.selectedVendorId).map((ing) => (
                            <option key={ing.id} value={String(ing.id)}>
                              {ing.name} - ₹{ing.pricePerUnit}/{ing.unit}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label text-sm">Grams per Sachet</label>
                      <input
                        type="number"
                        step="0.1"
                        value={currentRecipeItem.gramsPerSachet}
                        onChange={(e) => setCurrentRecipeItem({ ...currentRecipeItem, gramsPerSachet: e.target.value })}
                        className="input-field"
                        placeholder="6.5"
                      />
                    </div>
                  </div>
                  <button onClick={handleAddRecipeItem} className="btn-primary w-full flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add to {currentDay} Recipe
                  </button>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const currentIndex = DAYS.indexOf(currentDay);
                      if (currentIndex > 0) setCurrentDay(DAYS[currentIndex - 1]);
                    }}
                    disabled={currentDay === 'MON'}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Previous Day
                  </button>
                  <button
                    onClick={() => {
                      const currentIndex = DAYS.indexOf(currentDay);
                      if (currentIndex < 6) setCurrentDay(DAYS[currentIndex + 1]);
                    }}
                    disabled={currentDay === 'SUN'}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    Next Day
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleSaveSKU}
                  disabled={completedDays.length !== 7}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingSKU ? 'Update SKU' : 'Save SKU'} ({completedDays.length}/7 Complete)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Production Calculator - Will continue in next part */}
      {showCalculator && (
        <div 
          className="card" 
          style={{ 
            position: 'relative', 
            zIndex: 10,
            overflow: 'visible'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Production Calculator</h2>
            <button
              onClick={() => {
                setShowCalculator(false);
                setProductionRequirements(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
              <label className="label">Select SKU</label>
              <select
                value={selectedSKU?.id || ''}
                onChange={(e) => {
                  const skuId = e.target.value;
                  const sku = skus.find((s) => String(s.id) === String(skuId));
                  if (sku) {
                    setSelectedSKU(sku);
                    setProductionRequirements(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="input-field"
                style={{ 
                  zIndex: 99999, 
                  position: 'relative',
                  pointerEvents: 'auto',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Select SKU --</option>
                {skus.map((sku) => (
                  <option key={sku.id} value={String(sku.id)}>
                    {sku.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
              <label className="label">Pack Type</label>
              <select
                value={calculatorData.packType}
                onChange={(e) => {
                  setCalculatorData({ ...calculatorData, packType: e.target.value });
                  setProductionRequirements(null);
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="input-field"
                style={{ 
                  zIndex: 99999, 
                  position: 'relative',
                  pointerEvents: 'auto',
                  cursor: 'pointer'
                }}
              >
                <option value="weekly">Weekly Pack (7 different sachets)</option>
                <option value="monthly">Monthly Pack (28 sachets = 4 weeks)</option>
              </select>
            </div>
            <div>
              <label className="label">Number of Packs</label>
              <input
                type="number"
                value={calculatorData.numberOfPacks}
                onChange={(e) => {
                  setCalculatorData({ ...calculatorData, numberOfPacks: e.target.value });
                  setProductionRequirements(null);
                }}
                className="input-field"
                placeholder="e.g., 80"
              />
            </div>
            <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
              <label className="label">Select Vendor <span className="text-gray-500 text-xs">(Optional)</span></label>
              <select
                value={calculatorData.selectedVendorId}
                onChange={(e) => {
                  setCalculatorData({ ...calculatorData, selectedVendorId: e.target.value });
                  setProductionRequirements(null);
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="input-field"
                style={{ 
                  zIndex: 99999, 
                  position: 'relative',
                  pointerEvents: 'auto',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Use Default Pricing --</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={String(vendor.id)}>
                    {vendor.name} ({vendor.ingredients.length} ingredients)
                  </option>
                ))}
              </select>
              {calculatorData.selectedVendorId && (
                <p className="text-xs text-blue-600 mt-1">
                  Calculations will use {vendors.find(v => String(v.id) === String(calculatorData.selectedVendorId))?.name} pricing
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleCalculateProduction}
            className="btn-primary flex items-center gap-2 mb-6"
          >
            <Calculator className="w-5 h-5" />
            Calculate Requirements
          </button>

          {/* Production Requirements Display */}
          {productionRequirements && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Production Requirements</h3>
                <div className="flex gap-2">
                  <button onClick={exportToCSV} className="btn-secondary text-sm">
                    Export CSV
                  </button>
                  <button onClick={() => window.print()} className="btn-secondary text-sm">
                    Print
                  </button>
                </div>
              </div>

              {/* Consolidated Ingredients Table */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3">Ingredient</th>
                      <th className="text-right p-3">Total Grams</th>
                      <th className="text-right p-3">Total Kg</th>
                      <th className="text-right p-3">Available</th>
                      <th className="text-right p-3">Shortage</th>
                      <th className="text-right p-3">Cost/g</th>
                      <th className="text-right p-3">Total Cost</th>
                      <th className="text-left p-3">Vendor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionRequirements.requirements.map((req, index) => (
                      <tr
                        key={index}
                        className={`border-b ${req.hasShortage ? 'bg-red-50' : ''}`}
                      >
                        <td className="p-3 font-medium">{req.ingredientName}</td>
                        <td className="p-3 text-right">{req.totalGrams.toFixed(0)}</td>
                        <td className="p-3 text-right font-semibold">{req.totalKg}</td>
                        <td className="p-3 text-right">{req.available.toFixed(0)}g</td>
                        <td className="p-3 text-right">
                          {req.shortage > 0 && (
                            <span className="text-red-600 font-bold">{req.shortage.toFixed(0)}g</span>
                          )}
                        </td>
                        <td className="p-3 text-right">₹{req.pricePerGram.toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold">₹{req.totalCost.toFixed(2)}</td>
                        <td className="p-3">{req.recommendedVendor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-primary-900">Production Summary</h4>
                  {productionRequirements.selectedVendorName && (
                    <div className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                      Using: {productionRequirements.selectedVendorName} Pricing
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Sachets</p>
                    <p className="text-2xl font-bold text-gray-900">{productionRequirements.totalSachets}</p>
                    <p className="text-xs text-gray-500">({productionRequirements.multiplier} of each day)</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Raw Material Cost</p>
                    <p className="text-2xl font-bold text-primary-700">
                      ₹{productionRequirements.totalRawMaterialCost.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Cost per Pack</p>
                    <p className="text-2xl font-bold text-accent-600">
                      ₹{productionRequirements.costPerPack.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Cost per Sachet</p>
                    <p className="text-2xl font-bold text-gray-700">
                      ₹{productionRequirements.costPerSachet.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Day-by-Day Breakdown (Expandable) */}
              <details className="mt-6 bg-gray-50 p-4 rounded-lg">
                <summary className="font-bold text-gray-900 cursor-pointer">
                  📅 Day-by-Day Breakdown (Click to expand)
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DAYS.map((day) => (
                    <div key={day} className={`p-4 rounded-lg border-2 ${DAY_COLORS_LIGHT[day]}`}>
                      <h5 className={`font-bold mb-2 text-white px-3 py-1 rounded ${DAY_COLORS[day]}`}>{day}</h5>
                      <div className="space-y-1 text-sm">
                        {productionRequirements.dayBreakdown[day].map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.ingredientName}:</span>
                            <span className="font-semibold">{item.totalGrams.toFixed(0)}g</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* SKU List */}
      {!showForm && !showCalculator && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {skus.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No SKUs created yet</p>
              <p className="text-gray-400 text-sm mt-2">
                Create your first product with 7-day unique recipes
              </p>
            </div>
          ) : (
            skus.map((sku) => (
              <div key={sku.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{sku.name}</h3>
                    <p className="text-sm text-gray-600">{sku.description}</p>
                    <p className="text-sm text-primary font-semibold mt-1">
                      Target: {sku.targetWeightPerSachet}g per sachet
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(sku)}
                      className="text-primary hover:text-primary-700"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sku.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 7-Day Recipe Preview */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">7-Day Recipes</h4>
                  <div className="grid grid-cols-7 gap-1 mb-4">
                    {DAYS.map((day) => (
                      <div key={day} className={`${DAY_COLORS[day]} text-white text-center py-2 rounded text-xs font-bold`}>
                        {day}
                        <div className="text-[10px] mt-1">
                          {sku.recipes[day].length} ing
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pack Details */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-600 font-semibold mb-1">WEEKLY PACK</p>
                      <p className="text-sm text-gray-700">7 different sachets</p>
                      <p className="text-sm text-gray-700">
                        {(sku.weeklyPack.totalGrams / 1000).toFixed(2)} kg total
                      </p>
                      <p className="text-sm font-bold text-blue-700">
                        ₹{sku.weeklyPack.rawMaterialCost.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-accent-50 p-3 rounded-lg">
                      <p className="text-xs text-accent-600 font-semibold mb-1">MONTHLY PACK</p>
                      <p className="text-sm text-gray-700">28 sachets (4 weeks)</p>
                      <p className="text-sm text-gray-700">
                        {(sku.monthlyPack.totalGrams / 1000).toFixed(2)} kg total
                      </p>
                      <p className="text-sm font-bold text-accent-700">
                        ₹{sku.monthlyPack.rawMaterialCost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
