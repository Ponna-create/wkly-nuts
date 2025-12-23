import React, { useState } from 'react';
import { Plus, Edit, Trash2, Calculator, X, Package, ChevronLeft, ChevronRight, Check, Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import logo from '../assets/wkly-nuts-logo.png';

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
  const { state, dispatch, showToast, isLoading } = useApp();
  const { skus = [], vendors = [] } = state;

  // Show loading state while data is being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-500">Loading SKU Management...</p>
        </div>
      </div>
    );
  }
  
  // Helper function for flexible ingredient matching
  const matchIngredient = (recipeName, vendorName) => {
    const recipe = recipeName.toLowerCase().trim();
    const vendor = vendorName.toLowerCase().trim();
    
    // Exact match
    if (recipe === vendor) return true;
    
    // Flexible matching for common variations
    const normalizeName = (name) => {
      return name
        .replace(/\s+/g, ' ') // normalize spaces
        .replace(/[^\w\s]/g, '') // remove special characters
        .trim();
    };
    
    const normalizedRecipe = normalizeName(recipe);
    const normalizedVendor = normalizeName(vendor);
    
    // Check if one contains the other (for cases like "Almond" vs "Almonds")
    if (normalizedRecipe.includes(normalizedVendor) || normalizedVendor.includes(normalizedRecipe)) {
      return true;
    }
    
    // Check for common ingredient variations
    const commonVariations = {
      'almond': ['almonds', 'almond'],
      'walnut': ['walnuts', 'walnut'],
      'cashew': ['cashews', 'cashew'],
      'raisin': ['raisins', 'raisin'],
      'date': ['dates', 'date'],
      'pista': ['pistachio', 'pista', 'pistachios', 'pista salted', 'salted pista'],
      'pumpkin': ['pumpkin seed', 'pumpkin seeds'],
      'sunflower': ['sunflower seed', 'sunflower seeds'],
      'black raisin': ['black raisins', 'black raisin', 'raisins with seeds', 'raisin with seeds'],
      'yellow raisin': ['yellow raisins', 'yellow raisin']
    };
    
    for (const [key, variations] of Object.entries(commonVariations)) {
      if (variations.some(v => normalizedRecipe.includes(v)) && 
          variations.some(v => normalizedVendor.includes(v))) {
        return true;
      }
    }
    
    return false;
  };
  
  const [showForm, setShowForm] = useState(false);
  const [editingSKU, setEditingSKU] = useState(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState(null);
  const [orderListMode, setOrderListMode] = useState('full'); // 'full' or 'shortage'
  const [showPurchaseList, setShowPurchaseList] = useState(false); // Toggle simplified Purchase List view (only Ingredient + Purchase Kg)
  
  const [currentStep, setCurrentStep] = useState(1); // 1 = Basic Info, 2 = Day Recipes / Single Unit Details
  const [currentDay, setCurrentDay] = useState('MON');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    skuType: 'weekly', // 'weekly' or 'single'
    targetWeightPerSachet: '', // For weekly packs
    unitWeight: '', // For single unit SKUs (in kg, e.g., 0.5 or 1)
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
    // For single unit SKUs - direct ingredient list
    singleUnitIngredients: [],
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
    if (!vendors || !Array.isArray(vendors)) return ingredients;
    vendors.forEach((vendor) => {
      if (vendor && vendor.ingredients && Array.isArray(vendor.ingredients)) {
        vendor.ingredients.forEach((ing) => {
          ingredients.push({
            ...ing,
            vendorId: vendor.id,
            vendorName: vendor.name,
          });
        });
      }
    });
    return ingredients;
  };

  const getIngredientsByVendor = (vendorId) => {
    if (!vendorId || !vendors || !Array.isArray(vendors)) return [];
    const vendor = vendors.find(v => v.id == vendorId);
    if (!vendor || !vendor.ingredients || !Array.isArray(vendor.ingredients)) return [];
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
      skuType: 'weekly',
      targetWeightPerSachet: '',
      unitWeight: '',
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
      singleUnitIngredients: [],
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

  // Single unit ingredient handlers
  const handleAddSingleUnitIngredient = () => {
    if (!currentRecipeItem.ingredientId || !currentRecipeItem.gramsPerSachet) {
      showToast('Please select ingredient and enter grams per unit', 'error');
      return;
    }

    if (!formData.selectedVendorId) {
      showToast('Please select a vendor first', 'error');
      return;
    }

    const vendorIngredients = getIngredientsByVendor(formData.selectedVendorId);
    const ingredient = vendorIngredients.find((ing) => ing.id == currentRecipeItem.ingredientId);

    if (!ingredient) {
      showToast('Ingredient not found for selected vendor', 'error');
      return;
    }

    const gramsPerUnit = parseFloat(currentRecipeItem.gramsPerSachet);
    const unitWeightKg = parseFloat(formData.unitWeight) || 0;
    const unitWeightGrams = unitWeightKg * 1000;
    const percentage = unitWeightGrams > 0 ? (gramsPerUnit / unitWeightGrams) * 100 : 0;

    const newIngredient = {
      id: Date.now() + Math.random(),
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      gramsPerUnit,
      percentage: percentage.toFixed(1),
      vendorId: ingredient.vendorId,
      vendorName: ingredient.vendorName,
      pricePerGram: ingredient.pricePerUnit / (ingredient.unit === 'kg' ? 1000 : 1),
      unit: ingredient.unit,
    };

    setFormData({
      ...formData,
      singleUnitIngredients: [...formData.singleUnitIngredients, newIngredient],
    });

    setCurrentRecipeItem({ ingredientId: '', gramsPerSachet: '' });
    showToast('Ingredient added', 'success');
  };

  const handleRemoveSingleUnitIngredient = (itemId) => {
    setFormData({
      ...formData,
      singleUnitIngredients: formData.singleUnitIngredients.filter((item) => item.id !== itemId),
    });
  };

  const getSingleUnitTotal = () => {
    return formData.singleUnitIngredients.reduce((sum, item) => sum + item.gramsPerUnit, 0);
  };

  const getCurrentDayTotal = () => {
    return formData.recipes[currentDay].reduce((sum, item) => sum + item.gramsPerSachet, 0);
  };

  const getCompletedDays = () => {
    return DAYS.filter((day) => formData.recipes[day].length > 0);
  };

  const calculateSKUTotals = () => {
    if (formData.skuType === 'single') {
      // For single unit SKUs, calculate based on unit weight
      const unitWeightKg = parseFloat(formData.unitWeight) || 0;
      const unitWeightGrams = unitWeightKg * 1000;
      let totalRawMaterialCost = 0;

      formData.singleUnitIngredients.forEach((item) => {
        totalRawMaterialCost += item.gramsPerUnit * item.pricePerGram;
      });

      return {
        singleUnit: {
          unitWeight: unitWeightKg,
          unitWeightGrams: unitWeightGrams,
          totalGrams: unitWeightGrams,
          rawMaterialCost: totalRawMaterialCost,
        },
      };
    } else {
      // Weekly pack calculation (existing logic)
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
    }
  };

  const handleSaveSKU = () => {
    if (!formData.name || !formData.description) {
      showToast('Please fill in all basic information', 'error');
      return;
    }

    if (formData.skuType === 'weekly') {
      // Weekly pack validation
      if (!formData.targetWeightPerSachet) {
        showToast('Please enter target weight per sachet', 'error');
        return;
      }
      const completedDays = getCompletedDays();
      if (completedDays.length !== 7) {
        showToast(`Please complete all 7 day recipes (${completedDays.length}/7 done)`, 'error');
        return;
      }
    } else {
      // Single unit validation
      if (!formData.unitWeight) {
        showToast('Please enter unit weight (e.g., 0.5 or 1 for kg)', 'error');
        return;
      }
      if (formData.singleUnitIngredients.length === 0) {
        showToast('Please add at least one ingredient', 'error');
        return;
      }
    }

    const totals = calculateSKUTotals();

    const skuData = {
      ...formData,
      ...totals,
      targetWeightPerSachet: formData.skuType === 'weekly' ? parseFloat(formData.targetWeightPerSachet) : null,
      unitWeight: formData.skuType === 'single' ? parseFloat(formData.unitWeight) : null,
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
      skuType: sku.skuType || 'weekly',
      targetWeightPerSachet: sku.targetWeightPerSachet || '',
      unitWeight: sku.unitWeight || '',
      selectedVendorId: sku.selectedVendorId || '',
      recipes: sku.recipes || {
        MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [],
      },
      singleUnitIngredients: sku.singleUnitIngredients || [],
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
      showToast('Please select SKU and enter number of packs/units', 'error');
      return;
    }

    // Handle single unit SKUs differently
    if (selectedSKU.skuType === 'single') {
      const numberOfUnits = parseInt(calculatorData.numberOfPacks);
      const selectedVendor = calculatorData.selectedVendorId 
        ? vendors.find(v => String(v.id) === String(calculatorData.selectedVendorId))
        : null;

      const consolidatedIngredients = new Map();

      // Process single unit ingredients
      if (selectedSKU.singleUnitIngredients && selectedSKU.singleUnitIngredients.length > 0) {
        selectedSKU.singleUnitIngredients.forEach((item) => {
          let pricePerGram = item.pricePerGram;
          let vendorName = item.vendorName;
          
          if (selectedVendor) {
            const vendorIng = selectedVendor.ingredients.find(ing => 
              matchIngredient(item.ingredientName, ing.name)
            );
            if (vendorIng) {
              pricePerGram = vendorIng.unit === 'kg' ? vendorIng.pricePerUnit / 1000 : vendorIng.pricePerUnit;
              vendorName = selectedVendor.name;
            } else {
              pricePerGram = 0;
              vendorName = `${selectedVendor.name} (Not Supplied)`;
            }
          }
          
          const totalGrams = item.gramsPerUnit * numberOfUnits;
          const totalCost = totalGrams * pricePerGram;

          if (consolidatedIngredients.has(item.ingredientName)) {
            const existing = consolidatedIngredients.get(item.ingredientName);
            consolidatedIngredients.set(item.ingredientName, {
              ...existing,
              totalGrams: existing.totalGrams + totalGrams,
              totalCost: existing.totalCost + totalCost,
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
      }

      // Add vendor availability info
      const requirements = Array.from(consolidatedIngredients.values()).map((req) => {
        if (selectedVendor) {
          const vendorIng = selectedVendor.ingredients.find((ing) => 
            matchIngredient(req.ingredientName, ing.name)
          );
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
              vendorPrice: vendorIng.pricePerUnit,
              vendorUnit: vendorIng.unit,
            };
          } else {
            return {
              ...req,
              pricePerGram: 0,
              totalCost: 0,
              totalKg: (req.totalGrams / 1000).toFixed(2),
              available: 0,
              shortage: req.totalGrams,
              recommendedVendor: `${selectedVendor.name} (Not Supplied)`,
              hasShortage: true,
              vendorPrice: null,
              vendorUnit: null,
            };
          }
        } else {
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
                vendorPrice: vendorIng.pricePerUnit,
                vendorUnit: vendorIng.unit,
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
            vendorPrice: recommendedVendor?.vendorPrice || null,
            vendorUnit: recommendedVendor?.vendorUnit || null,
          };
        }
      });

      const totalRawMaterialCost = requirements.reduce((sum, req) => sum + req.totalCost, 0);
      const costPerUnit = totalRawMaterialCost / numberOfUnits;

      setProductionRequirements({
        requirements,
        totalUnits: numberOfUnits,
        totalRawMaterialCost,
        costPerUnit,
        numberOfPacks: numberOfUnits,
        packType: 'single',
        selectedVendorName: selectedVendor?.name || null,
      });

      setShowPurchaseList(false);
      showToast('Production requirements calculated', 'success');
      return;
    }

    // Weekly pack calculation (existing logic)
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
      
      // If vendor is selected, use ONLY that vendor's pricing; otherwise use SKU recipe pricing
      dayBreakdown[day] = dayRecipe.map((item) => {
        let pricePerGram = item.pricePerGram;
        
        // If a vendor is selected, STRICTLY use only that vendor's price
        if (selectedVendor) {
          const vendorIng = selectedVendor.ingredients.find(ing => 
            matchIngredient(item.ingredientName, ing.name)
          );
          if (vendorIng) {
            // Ingredient available from selected vendor - use vendor's price
            pricePerGram = vendorIng.unit === 'kg' ? vendorIng.pricePerUnit / 1000 : vendorIng.pricePerUnit;
          } else {
            // Ingredient NOT available from selected vendor - set to 0
            pricePerGram = 0;
          }
        }
        
        return {
        ingredientName: item.ingredientName,
        gramsPerSachet: item.gramsPerSachet,
        quantity: multiplier,
        totalGrams: item.gramsPerSachet * multiplier,
          pricePerGram: pricePerGram,
          pricePerSachet: item.gramsPerSachet * pricePerGram, // Price for one sachet
          totalCost: item.gramsPerSachet * multiplier * pricePerGram,
        };
      });

      // Consolidate ingredients
      dayRecipe.forEach((item) => {
        let pricePerGram = item.pricePerGram;
        let vendorName = item.vendorName;
        
        // If vendor is selected, STRICTLY use only that vendor's pricing
        if (selectedVendor) {
          const vendorIng = selectedVendor.ingredients.find(ing => 
            matchIngredient(item.ingredientName, ing.name)
          );
          if (vendorIng) {
            // Ingredient available from selected vendor
            pricePerGram = vendorIng.unit === 'kg' ? vendorIng.pricePerUnit / 1000 : vendorIng.pricePerUnit;
            vendorName = selectedVendor.name;
          } else {
            // Ingredient NOT available from selected vendor - set costs to 0
            pricePerGram = 0;
            vendorName = `${selectedVendor.name} (Not Supplied)`;
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
            // When vendor selected, override with vendor-specific pricing
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
        const vendorIng = selectedVendor.ingredients.find((ing) => 
          matchIngredient(req.ingredientName, ing.name)
        );
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
            // Add vendor price with unit for display
            vendorPrice: vendorIng.pricePerUnit,
            vendorUnit: vendorIng.unit,
          };
        } else {
          // Ingredient NOT available from selected vendor - set all costs to 0
          return {
            ...req,
            pricePerGram: 0, // No pricing available from selected vendor
            totalCost: 0, // No cost calculation possible
            totalKg: (req.totalGrams / 1000).toFixed(2),
            available: 0,
            shortage: req.totalGrams,
            recommendedVendor: `${selectedVendor.name} (Not Supplied)`,
            hasShortage: true,
            vendorPrice: null,
            vendorUnit: null,
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
              vendorPrice: vendorIng.pricePerUnit,
              vendorUnit: vendorIng.unit,
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
          // Add vendor price with unit for display
          vendorPrice: recommendedVendor?.vendorPrice || null,
          vendorUnit: recommendedVendor?.vendorUnit || null,
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

    // Reset purchase list view when new calculation is made
    setShowPurchaseList(false);

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
              <span className={currentStep === 2 ? 'text-primary font-semibold' : 'text-gray-600'}>
                {formData.skuType === 'single' ? 'Single Unit Details' : `7-Day Recipes (${completedDays.length}/7)`}
              </span>
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
                    placeholder="e.g., Day Pack, Night Pack, Dates 0.5kg"
                  />
                </div>
                <div>
                  <label className="label">SKU Type <span className="text-red-500">*</span></label>
                  <select
                    value={formData.skuType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData({
                        ...formData,
                        skuType: newType,
                        // Reset type-specific fields when switching
                        targetWeightPerSachet: newType === 'weekly' ? formData.targetWeightPerSachet : '',
                        unitWeight: newType === 'single' ? formData.unitWeight : '',
                        singleUnitIngredients: newType === 'single' ? formData.singleUnitIngredients : [],
                        recipes: newType === 'weekly' ? formData.recipes : {
                          MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [],
                        },
                      });
                    }}
                    className="input-field"
                  >
                    <option value="weekly">Weekly Pack (7-day recipes)</option>
                    <option value="single">Single Unit (e.g., Dates 0.5kg, 1kg)</option>
                  </select>
                </div>
                {formData.skuType === 'weekly' ? (
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
                ) : (
                  <div>
                    <label className="label">Unit Weight (kg) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.unitWeight}
                      onChange={(e) => setFormData({ ...formData, unitWeight: e.target.value })}
                      className="input-field"
                      placeholder="e.g., 0.5 or 1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter weight in kilograms (e.g., 0.5 for half kg, 1 for 1 kg)</p>
                  </div>
                )}
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
                        {vendor.name} ({vendor?.ingredients?.length || 0} ingredients)
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
                    if (!formData.name || !formData.description || !formData.selectedVendorId) {
                      showToast('Please fill in all required fields including vendor selection', 'error');
                      return;
                    }
                    if (formData.skuType === 'weekly' && !formData.targetWeightPerSachet) {
                      showToast('Please enter target weight per sachet', 'error');
                      return;
                    }
                    if (formData.skuType === 'single' && !formData.unitWeight) {
                      showToast('Please enter unit weight', 'error');
                      return;
                    }
                    setCurrentStep(2);
                  }}
                  className="btn-primary"
                >
                  Next: {formData.skuType === 'single' ? 'Add Ingredients' : 'Build Day Recipes'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Day Recipes or Single Unit Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {formData.skuType === 'single' ? (
                /* Single Unit Form */
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Single Unit SKU: {formData.name}</h3>
                    <p className="text-sm text-gray-600">
                      Unit Weight: <span className="font-semibold">{formData.unitWeight} kg</span>
                    </p>
                  </div>

                  {/* Added Ingredients */}
                  {formData.singleUnitIngredients.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <h4 className="font-semibold text-gray-900">Ingredients</h4>
                      {formData.singleUnitIngredients.map((item) => (
                        <div key={item.id} className="bg-white p-3 rounded-lg flex justify-between items-center shadow-sm border">
                          <div className="flex-1">
                            <span className="font-semibold text-gray-900">{item.ingredientName}</span>
                            <span className="text-sm text-gray-600 ml-3">
                              {item.gramsPerUnit}g ({item.percentage}%)
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveSingleUnitIngredient(item.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-300">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-900">Total Weight:</span>
                          <span className={`font-bold text-lg ${
                            Math.abs(getSingleUnitTotal() - (parseFloat(formData.unitWeight) * 1000)) === 0 
                              ? 'text-green-600' 
                              : Math.abs(getSingleUnitTotal() - (parseFloat(formData.unitWeight) * 1000)) <= 10
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}>
                            {getSingleUnitTotal().toFixed(1)}g / {(parseFloat(formData.unitWeight) * 1000).toFixed(1)}g
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Vendor Info */}
                  {formData.selectedVendorId && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
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
                        <label className="label text-sm">Grams per Unit</label>
                        <input
                          type="number"
                          step="0.1"
                          value={currentRecipeItem.gramsPerSachet}
                          onChange={(e) => setCurrentRecipeItem({ ...currentRecipeItem, gramsPerSachet: e.target.value })}
                          className="input-field"
                          placeholder="e.g., 500"
                        />
                      </div>
                    </div>
                    <button onClick={handleAddSingleUnitIngredient} className="btn-primary w-full flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" />
                      Add Ingredient
                    </button>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="btn-secondary"
                    >
                      Back to Basic Info
                    </button>
                    <button
                      onClick={handleSaveSKU}
                      disabled={formData.singleUnitIngredients.length === 0}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingSKU ? 'Update SKU' : 'Save SKU'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Weekly Pack Form (existing) */
                <>
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
                </>
              )}
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
            {selectedSKU && selectedSKU.skuType === 'single' ? (
              <div>
                <label className="label">Number of Units</label>
                <input
                  type="number"
                  value={calculatorData.numberOfPacks}
                  onChange={(e) => {
                    setCalculatorData({ ...calculatorData, numberOfPacks: e.target.value });
                    setProductionRequirements(null);
                  }}
                  className="input-field"
                  placeholder="e.g., 50"
                />
              </div>
            ) : (
              <>
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
              </>
            )}
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
                    {vendor.name} ({vendor?.ingredients?.length || 0} ingredients)
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
            <div className="production-requirements-container">
              {/* Header with CSV Export - Always visible */}
              <div className="flex justify-between items-center mb-4">
                <div>
                <h3 className="text-lg font-bold text-gray-900">Production Requirements</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {productionRequirements.packType === 'single' ? (
                      <>Total quantities for {productionRequirements.totalUnits} units</>
                    ) : (
                      <>Total quantities consolidated across all {DAYS.length} days ({productionRequirements.numberOfPacks} {productionRequirements.packType === 'weekly' ? 'weekly' : 'monthly'} packs = {productionRequirements.totalSachets} total sachets)</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportToCSV} className="btn-secondary text-sm">
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Consolidated Ingredients Table - Always visible */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left p-3">Ingredient</th>
                      <th className="text-right p-3">Total Grams</th>
                      <th className="text-right p-3">Total Kg</th>
                      <th className="text-right p-3">Available</th>
                      <th className="text-right p-3">Shortage</th>
                      <th className="text-right p-3">Vendor Price</th>
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
                        <td className="p-3 text-right">
                          {req.vendorPrice !== null && req.vendorUnit ? (
                            <div>
                              <span className="font-semibold text-blue-700">₹{req.vendorPrice.toFixed(2)}</span>
                              <span className="text-xs text-gray-600 ml-1">/ {req.vendorUnit}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {req.pricePerGram > 0 ? (
                            `₹${req.pricePerGram.toFixed(2)}`
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {req.totalCost > 0 ? (
                            `₹${req.totalCost.toFixed(2)}`
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="p-3">
                          {req.recommendedVendor.includes('(Not Supplied)') ? (
                            <span className="text-orange-600 font-medium">{req.recommendedVendor}</span>
                          ) : (
                            req.recommendedVendor
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary - Always visible */}
              <div className="bg-primary-50 p-6 rounded-lg border border-primary-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-primary-900">Production Summary</h4>
                  {productionRequirements.selectedVendorName && (
                    <div className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                      Using: {productionRequirements.selectedVendorName} Pricing
                    </div>
                  )}
                </div>
                {productionRequirements.packType === 'single' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Units</p>
                      <p className="text-2xl font-bold text-gray-900">{productionRequirements.totalUnits}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Raw Material Cost</p>
                      <p className="text-2xl font-bold text-primary-700">
                        ₹{productionRequirements.totalRawMaterialCost.toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-600">Cost per Unit</p>
                      <p className="text-2xl font-bold text-accent-600">
                        ₹{productionRequirements.costPerUnit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>

              {/* Day-by-Day Breakdown (Expandable) - Only for weekly packs */}
              {productionRequirements.packType !== 'single' && (
              <details className="mt-6 bg-gray-50 p-4 rounded-lg">
                <summary className="font-bold text-gray-900 cursor-pointer">
                  📅 Day-by-Day Breakdown (Click to expand)
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DAYS.map((day) => (
                    <div key={day} className={`p-4 rounded-lg border-2 ${DAY_COLORS_LIGHT[day]}`}>
                      <h5 className={`font-bold mb-2 text-white px-3 py-1 rounded ${DAY_COLORS[day]}`}>{day}</h5>
                      <div className="text-xs text-gray-600 mb-2 px-1">
                        Per sachet recipe
                      </div>
                      {/* Header row */}
                      <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-300 text-xs font-semibold text-gray-700">
                        <span className="flex-1">Ingredient</span>
                        <div className="flex gap-6">
                          <span>Weight</span>
                          <span className="ml-4">Price</span>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm mb-2">
                        {productionRequirements.dayBreakdown[day].map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="flex-1">{item.ingredientName}:</span>
                            <div className="flex gap-6 items-center">
                              <span className="font-semibold w-12 text-right">{item.gramsPerSachet}g</span>
                              {item.pricePerSachet > 0 ? (
                                <span className="text-green-600 font-medium w-16 text-right">
                                  ₹{item.pricePerSachet.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-400 w-16 text-right">N/A</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Total row */}
                      {(() => {
                        const dayTotal = productionRequirements.dayBreakdown[day].reduce(
                          (sum, item) => sum + (item.pricePerSachet || 0), 
                          0
                        );
                        return (
                          <div className="flex justify-between items-center pt-2 mt-2 border-t-2 border-gray-400 font-bold text-base">
                            <span>Total:</span>
                            <span className="text-green-700">₹{dayTotal.toFixed(2)}</span>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
                
                {/* Weekly Summary - 3 Details */}
                {(() => {
                  // Calculate totals across all 7 days
                  let totalGramsPerWeek = 0;
                  let totalCostPerWeek = 0;
                  let totalSachets = 0;
                  
                  DAYS.forEach((day) => {
                    productionRequirements.dayBreakdown[day].forEach((item) => {
                      totalGramsPerWeek += item.gramsPerSachet;
                      totalCostPerWeek += item.pricePerSachet || 0;
                    });
                    totalSachets += 1; // One sachet per day
                  });
                  
                  const averageSachetPrice = totalSachets > 0 ? totalCostPerWeek / totalSachets : 0;
                  
                  return (
                    <div className="mt-6 bg-gradient-to-r from-primary-50 to-accent-50 p-6 rounded-lg border-2 border-primary-200">
                      <h4 className="font-bold text-gray-900 mb-4 text-center">Weekly Summary</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                          <p className="text-sm text-gray-600 mb-1">Grams per Week</p>
                          <p className="text-2xl font-bold text-primary-700">{totalGramsPerWeek.toFixed(0)}g</p>
                          <p className="text-xs text-gray-500 mt-1">Total</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                          <p className="text-sm text-gray-600 mb-1">Cost per Week (7 days)</p>
                          <p className="text-2xl font-bold text-green-700">₹{totalCostPerWeek.toFixed(2)}</p>
                          <p className="text-xs text-gray-500 mt-1">Total</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                          <p className="text-sm text-gray-600 mb-1">Average Sachet Price</p>
                          <p className="text-2xl font-bold text-accent-700">₹{averageSachetPrice.toFixed(2)}</p>
                          <p className="text-xs text-gray-500 mt-1">Avg Price</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </details>
              )}

              {/* Ingredients Order List (Expandable) - Always visible */}
              <details className="mt-6 bg-gray-50 p-4 rounded-lg">
                <summary className="font-bold text-gray-900 cursor-pointer">
                  📋 Ingredients Order List (Click to expand)
                </summary>
                <div className="mt-4 bg-white p-6 rounded-lg border-2 border-gray-200 order-list-print">
                  <div className="flex justify-between items-center mb-4 no-print">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Ingredients Order List</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Purchase list grouped by vendor - ready to send to suppliers
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Mode: {orderListMode === 'full' ? 'Full Order (All Ingredients)' : 'Shortage Only (Missing Items)'}
                      </p>
                    </div>
                    <div className="flex gap-3 items-center">
                      {/* Mode Toggle */}
                      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                        <button
                          onClick={() => setOrderListMode('full')}
                          className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                            orderListMode === 'full'
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Full Order
                        </button>
                        <button
                          onClick={() => setOrderListMode('shortage')}
                          className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                            orderListMode === 'shortage'
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Shortage Only
                        </button>
                      </div>
                      {/* Purchase List Button */}
                      <button
                        onClick={() => setShowPurchaseList(!showPurchaseList)}
                        className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                          showPurchaseList
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Purchase List
                      </button>
                      <button
                        onClick={() => {
                          // Find the order list element
                          const orderListElement = document.querySelector('.order-list-print');
                          if (!orderListElement) {
                            showToast('Order list not found', 'error');
                            return;
                          }

                          // Remove any existing print container
                          const existingPrintContainer = document.getElementById('print-only-container');
                          if (existingPrintContainer) {
                            existingPrintContainer.remove();
                          }

                          // Clone the order list content
                          const clonedContent = orderListElement.cloneNode(true);
                          
                          // Remove no-print elements from clone
                          const noPrintElements = clonedContent.querySelectorAll('.no-print');
                          noPrintElements.forEach(el => el.remove());

                          // Create print-only container
                          const printContainer = document.createElement('div');
                          printContainer.id = 'print-only-container';
                          printContainer.style.cssText = `
                            position: absolute;
                            left: -9999px;
                            top: 0;
                            width: 210mm;
                            padding: 20px;
                            background: white;
                          `;
                          printContainer.appendChild(clonedContent);
                          document.body.appendChild(printContainer);

                          // Open details if closed
                          const detailsElement = orderListElement.closest('details');
                          if (detailsElement && !detailsElement.open) {
                            detailsElement.open = true;
                          }

                          // Small delay then print
                          setTimeout(() => {
                            window.print();
                            // Clean up after print
                            setTimeout(() => {
                              if (printContainer) {
                                printContainer.remove();
                              }
                            }, 100);
                          }, 100);
                        }}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Printer size={18} />
                        Print / Save PDF
                      </button>
                    </div>
                  </div>

                {/* Professional Header for Print */}
                <div className="hidden print:block print:mb-2 print:pb-2 print:border-b print:border-gray-400">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <img 
                        src={logo} 
                        alt="WKLY Nuts Logo" 
                        className="h-10 print:h-8 w-auto object-contain"
                      />
                      <div>
                        <h2 className="text-lg print:text-base font-bold text-gray-900">WKLY Nuts</h2>
                        <p className="text-xs print:text-xs text-gray-600">Production Manager</p>
                      </div>
                    </div>
                    <div className="text-right text-xs print:text-xs text-gray-600">
                      <div>{new Date().toLocaleDateString('en-IN', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit' 
                      })}</div>
                      <div>{new Date().toLocaleTimeString('en-IN', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true
                      })}</div>
                    </div>
                  </div>
                </div>

                {/* Order List by Vendor */}
                {(() => {
                  // Filter requirements based on mode
                  const filteredRequirements = orderListMode === 'shortage'
                    ? productionRequirements.requirements.filter(req => req.shortage > 0)
                    : productionRequirements.requirements;

                  // Group by vendor
                  const vendorGroups = {};
                  filteredRequirements.forEach(req => {
                    const vendorName = req.recommendedVendor || 'Unknown Vendor';
                    if (!vendorGroups[vendorName]) {
                      vendorGroups[vendorName] = [];
                    }
                    vendorGroups[vendorName].push(req);
                  });

                  // Calculate totals
                  const calculateVendorTotal = (items) => {
                    return items.reduce((sum, item) => {
                      const quantityKg = orderListMode === 'shortage'
                        ? (item.shortage / 1000)
                        : parseFloat(item.totalKg);
                      const price = item.vendorPrice || 0;
                      return sum + (quantityKg * price);
                    }, 0);
                  };

                  return (
                    <div className="space-y-6">
                      {Object.entries(vendorGroups).map(([vendorName, items]) => {
                        const totalQuantity = items.reduce((sum, item) => {
                          const quantityKg = orderListMode === 'shortage'
                            ? (item.shortage / 1000)
                            : parseFloat(item.totalKg);
                          return sum + quantityKg;
                        }, 0);

                        return (
                          <div key={vendorName} className="border-2 border-gray-300 rounded-lg p-3 print:p-2 print:break-inside-avoid">
                            <div className="flex justify-between items-center mb-2 print:mb-1 pb-1 print:pb-1 border-b border-gray-400">
                              <h4 className="text-lg print:text-base font-bold text-gray-900">Order List</h4>
                              <div className="text-xs print:text-xs text-gray-600">
                                {items.length} ingredient{items.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            
                            <table className="w-full text-xs print:text-xs mb-2 print:mb-2">
                              <thead>
                                <tr className="bg-gray-100 border-b">
                                  {!showPurchaseList && <th className="text-left p-1 print:p-1">#</th>}
                                  <th className="text-left p-1 print:p-1">Ingredient</th>
                                  {!showPurchaseList && <th className="text-right p-1 print:p-1">Required (Kg)</th>}
                                  <th className="text-right p-1 print:p-1">
                                    {showPurchaseList ? 'Purchase (Kg)' : 'Purchase (1kg packs)'}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => {
                                  const quantityKg = orderListMode === 'shortage'
                                    ? (item.shortage / 1000)
                                    : parseFloat(item.totalKg);
                                  const purchaseKg = Math.ceil(quantityKg); // Round up to nearest 1kg
                                  const purchasePacks = purchaseKg; // Since vendors sell in 1kg packs

                                  return (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                      {!showPurchaseList && <td className="p-1 print:p-1 text-gray-600">{idx + 1}</td>}
                                      <td className="p-1 print:p-1 font-medium">{item.ingredientName}</td>
                                      {!showPurchaseList && <td className="p-1 print:p-1 text-right">{quantityKg.toFixed(2)}</td>}
                                      <td className="p-1 print:p-1 text-right font-semibold text-blue-700">
                                        {showPurchaseList 
                                          ? `${purchaseKg} kg`
                                          : `${purchasePacks} pack${purchasePacks !== 1 ? 's' : ''} (${purchaseKg} kg)`
                                        }
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                                  <td colSpan={showPurchaseList ? 1 : 2} className="p-1 print:p-1">Total</td>
                                  {!showPurchaseList && <td className="p-1 print:p-1 text-right">{totalQuantity.toFixed(2)} kg</td>}
                                  <td className="p-1 print:p-1 text-right text-blue-700">
                                    {showPurchaseList 
                                      ? `${Math.ceil(totalQuantity)} kg`
                                      : `${Math.ceil(totalQuantity)} pack${Math.ceil(totalQuantity) !== 1 ? 's' : ''} (${Math.ceil(totalQuantity)} kg)`
                                    }
                                  </td>
                                </tr>
                              </tfoot>
                            </table>

                            {/* Purchase Suggestion & Pack Calculation - Hide when Purchase List is active */}
                            {!showPurchaseList && (() => {
                              if (!productionRequirements || !selectedSKU) return null;

                              // Calculate how many times we can make the current production from purchased quantities
                              // Find the limiting ingredient (the one that will run out first)
                              const limitingFactor = items.reduce((min, item) => {
                                const requiredKg = orderListMode === 'shortage'
                                  ? (item.shortage / 1000)
                                  : parseFloat(item.totalKg);
                                const purchasedKg = Math.ceil(requiredKg);
                                
                                if (requiredKg <= 0) return min;
                                
                                const multiplier = purchasedKg / requiredKg; // How many times we can make the required quantity
                                return (!min || multiplier < min.multiplier) 
                                  ? { item: item.ingredientName, required: requiredKg, purchased: purchasedKg, multiplier } 
                                  : min;
                              }, null);

                              if (!limitingFactor) return null;

                              // Calculate packs possible based on limiting ingredient
                              const currentPackType = productionRequirements.packType;
                              const currentNumberOfPacks = productionRequirements.numberOfPacks;
                              const packsPossible = Math.floor(limitingFactor.multiplier * currentNumberOfPacks);
                              
                              // Convert to weekly/monthly based on current pack type
                              let weeklyPacksPossible = 0;
                              let monthlyPacksPossible = 0;
                              
                              if (currentPackType === 'weekly') {
                                weeklyPacksPossible = packsPossible;
                                monthlyPacksPossible = Math.floor(weeklyPacksPossible / 4);
                              } else {
                                monthlyPacksPossible = packsPossible;
                                weeklyPacksPossible = monthlyPacksPossible * 4;
                              }

                              return (
                                <div className="mt-2 pt-2 border-t border-gray-300 print:mt-1 print:pt-1 text-xs print:text-xs">
                                  <div className="grid grid-cols-2 gap-2 print:gap-1">
                                    <div>
                                      <span className="font-semibold text-gray-700">Suggested Purchase:</span>
                                      <div className="text-blue-700 font-bold">{Math.ceil(totalQuantity)} kg</div>
                                      <div className="text-gray-500 text-xs">(1kg packs)</div>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-gray-700">Packs Possible:</span>
                                      <div className="text-green-700">
                                        <div>Weekly: {weeklyPacksPossible} pack{weeklyPacksPossible !== 1 ? 's' : ''}</div>
                                        <div>Monthly: {monthlyPacksPossible} pack{monthlyPacksPossible !== 1 ? 's' : ''}</div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500 italic">
                                    * Based on limiting ingredient: {limitingFactor.item}
                                  </div>
                                </div>
                              );
                            })()}

                          </div>
                        );
                      })}

                      {Object.keys(vendorGroups).length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          {orderListMode === 'shortage'
                            ? 'No shortage items to order'
                            : 'No ingredients to order'}
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{sku.name}</h3>
                      {sku.skuType === 'single' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                          Single Unit
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{sku.description}</p>
                    {sku.skuType === 'single' ? (
                      <p className="text-sm text-primary font-semibold mt-1">
                        Unit Weight: {sku.unitWeight} kg
                      </p>
                    ) : (
                      <p className="text-sm text-primary font-semibold mt-1">
                        Target: {sku.targetWeightPerSachet}g per sachet
                      </p>
                    )}
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

                {/* Recipe Preview */}
                <div>
                  {sku.skuType === 'single' ? (
                    /* Single Unit Details */
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Ingredients</h4>
                      {sku.singleUnitIngredients && sku.singleUnitIngredients.length > 0 ? (
                        <div className="space-y-1 mb-4">
                          {sku.singleUnitIngredients.map((ing, idx) => (
                            <div key={idx} className="bg-gray-50 p-2 rounded text-sm flex justify-between">
                              <span>{ing.ingredientName}</span>
                              <span className="font-semibold">{ing.gramsPerUnit}g ({ing.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-4">No ingredients added</p>
                      )}
                      <div className="bg-blue-50 p-3 rounded-lg border-t">
                        <p className="text-xs text-blue-600 font-semibold mb-1">SINGLE UNIT</p>
                        <p className="text-sm text-gray-700">Weight: {sku.unitWeight} kg</p>
                        {sku.singleUnit && (
                          <>
                            <p className="text-sm text-gray-700">
                              Total: {(sku.singleUnit.totalGrams / 1000).toFixed(2)} kg
                            </p>
                            <p className="text-sm font-bold text-blue-700">
                              ₹{sku.singleUnit.rawMaterialCost.toFixed(2)} per unit
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Weekly Pack Details */
                    <>
                      <h4 className="font-semibold text-gray-900 mb-2">7-Day Recipes</h4>
                      <div className="grid grid-cols-7 gap-1 mb-4">
                        {DAYS.map((day) => (
                          <div key={day} className={`${DAY_COLORS[day]} text-white text-center py-2 rounded text-xs font-bold`}>
                            {day}
                            <div className="text-[10px] mt-1">
                              {sku.recipes[day]?.length || 0} ing
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
                            {(sku.weeklyPack?.totalGrams / 1000 || 0).toFixed(2)} kg total
                          </p>
                          <p className="text-sm font-bold text-blue-700">
                            ₹{sku.weeklyPack?.rawMaterialCost.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <div className="bg-accent-50 p-3 rounded-lg">
                          <p className="text-xs text-accent-600 font-semibold mb-1">MONTHLY PACK</p>
                          <p className="text-sm text-gray-700">28 sachets (4 weeks)</p>
                          <p className="text-sm text-gray-700">
                            {(sku.monthlyPack?.totalGrams / 1000 || 0).toFixed(2)} kg total
                          </p>
                          <p className="text-sm font-bold text-accent-700">
                            ₹{sku.monthlyPack?.rawMaterialCost.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
