import React, { useState } from 'react';
import { TrendingUp, BarChart3, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function VendorComparison() {
  const { state } = useApp();
  const { vendors, skus } = state;
  const [selectedSKU, setSelectedSKU] = useState('');
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [compareMode, setCompareMode] = useState('selected'); // 'selected' or 'all'


  const getSKURecipe = (skuId) => {
    const sku = skus.find(s => s.id == skuId);
    if (!sku || !sku.recipes) return [];
    
    // Combine all day recipes into one master recipe
    const allRecipes = [];
    Object.values(sku.recipes).forEach(dayRecipes => {
      dayRecipes.forEach(recipeItem => {
        const existing = allRecipes.find(item => item.ingredientName === recipeItem.ingredientName);
        if (existing) {
          existing.gramsPerSachet += recipeItem.gramsPerSachet;
        } else {
          allRecipes.push({ ...recipeItem });
        }
      });
    });
    
    return allRecipes;
  };

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
      'pista': ['pistachio', 'pista', 'pistachios'],
      'pumpkin': ['pumpkin seed', 'pumpkin seeds'],
      'sunflower': ['sunflower seed', 'sunflower seeds']
    };
    
    for (const [key, variations] of Object.entries(commonVariations)) {
      if (variations.some(v => normalizedRecipe.includes(v)) && 
          variations.some(v => normalizedVendor.includes(v))) {
        return true;
      }
    }
    
    return false;
  };

  const calculateVendorCosts = () => {
    if (!selectedSKU) return [];
    
    const recipe = getSKURecipe(selectedSKU);
    if (recipe.length === 0) return [];
    
    const vendorsToCompare = compareMode === 'all' ? vendors : vendors.filter(v => selectedVendors.includes(v.id));
    const vendorCosts = [];
    
    vendorsToCompare.forEach(vendor => {
      let totalCost = 0;
      let canSupplyAll = true;
      const missingIngredients = [];
      const availableIngredients = [];
      
      recipe.forEach(recipeItem => {
        const vendorIngredient = vendor.ingredients.find(ing => 
          matchIngredient(recipeItem.ingredientName, ing.name)
        );
        
        if (vendorIngredient) {
          const pricePerGram = vendorIngredient.pricePerUnit / (vendorIngredient.unit === 'kg' ? 1000 : 1);
          const cost = pricePerGram * recipeItem.gramsPerSachet;
          totalCost += cost;
          availableIngredients.push({
            name: recipeItem.ingredientName,
            gramsPerSachet: recipeItem.gramsPerSachet,
            pricePerGram: pricePerGram,
            cost: cost
          });
        } else {
          canSupplyAll = false;
          missingIngredients.push(recipeItem.ingredientName);
          availableIngredients.push({
            name: recipeItem.ingredientName,
            gramsPerSachet: recipeItem.gramsPerSachet,
            pricePerGram: 0,
            cost: 0,
            unavailable: true
          });
        }
      });
      
      vendorCosts.push({
        vendorId: vendor.id,
        vendorName: vendor.name,
        totalCost: canSupplyAll ? totalCost : null,
        costPerSachet: canSupplyAll ? totalCost : null,
        canSupplyAll,
        missingIngredients,
        ingredients: availableIngredients,
        availableCount: availableIngredients.filter(ing => !ing.unavailable).length,
        totalIngredients: recipe.length,
        coveragePercentage: (availableIngredients.filter(ing => !ing.unavailable).length / recipe.length) * 100
      });
    });
    
    return vendorCosts.sort((a, b) => {
      // First sort by coverage percentage (how many ingredients they can supply)
      if (a.coveragePercentage !== b.coveragePercentage) {
        return b.coveragePercentage - a.coveragePercentage;
      }
      // Then by cost if they have the same coverage
      if (a.canSupplyAll && b.canSupplyAll) {
        return a.totalCost - b.totalCost;
      }
      return 0;
    });
  };


  const exportComparison = () => {
    const vendorCosts = calculateVendorCosts();
    const recipe = getSKURecipe(selectedSKU);
    
    const csvContent = [
      'Vendor Comparison Report',
      `Generated: ${new Date().toLocaleDateString()}`,
      `SKU: ${skus.find(s => s.id == selectedSKU)?.name}`,
      '',
      'VENDOR COST COMPARISON',
      'Vendor,Cost per Sachet,Can Supply All,Missing Ingredients',
      ...vendorCosts.map(vendor => [
        vendor.vendorName,
        vendor.costPerSachet ? `₹${vendor.costPerSachet.toFixed(2)}` : 'N/A',
        vendor.canSupplyAll ? 'Yes' : 'No',
        vendor.missingIngredients ? vendor.missingIngredients.join('; ') : ''
      ].join(',')),
      '',
      'INGREDIENT BREAKDOWN',
      'Ingredient,Grams per Sachet,' + vendorCosts.map(v => v.vendorName).join(','),
      ...recipe.map(ingredient => [
        ingredient.ingredientName,
        ingredient.gramsPerSachet,
        ...vendorCosts.map(vendor => {
          const vendorIngredient = vendor.ingredients?.find(ing => ing.name.toLowerCase() === ingredient.ingredientName.toLowerCase());
          return vendorIngredient ? `₹${vendorIngredient.cost.toFixed(2)}` : 'N/A';
        })
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const vendorCosts = calculateVendorCosts();
  const cheapestVendor = vendorCosts.find(v => v.canSupplyAll !== false);
  const mostExpensiveVendor = vendorCosts.filter(v => v.canSupplyAll !== false).pop();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Comparison</h1>
          <p className="text-gray-600 mt-1">Compare vendor costs and find the most profitable suppliers</p>
        </div>
        <button
          onClick={exportComparison}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Export Report
        </button>
      </div>

      {/* SKU Selection */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Select SKU for Cost Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Select SKU</label>
            <select
              value={selectedSKU}
              onChange={(e) => {
                setSelectedSKU(e.target.value);
                setSelectedVendors([]);
              }}
              className="input-field"
            >
              <option value="">-- Select SKU --</option>
              {skus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {sku.name} {sku.recipes && Object.values(sku.recipes).some(recipes => recipes.length > 0) ? `(${getSKURecipe(sku.id).length} ingredients)` : '(No recipe)'}
                </option>
              ))}
            </select>
          </div>
          {selectedSKU && (
            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <p><span className="font-semibold">Recipe:</span> {getSKURecipe(selectedSKU).length} ingredients</p>
                <p><span className="font-semibold">Target Weight:</span> {skus.find(s => s.id == selectedSKU)?.targetWeightPerSachet}g per sachet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Selection */}
      {selectedSKU && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Choose Vendors to Compare</h2>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <button
              onClick={() => setCompareMode('all')}
              className={`px-4 py-2 rounded-lg border ${
                compareMode === 'all' 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Compare All Vendors
            </button>
            <button
              onClick={() => setCompareMode('selected')}
              className={`px-4 py-2 rounded-lg border ${
                compareMode === 'selected' 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Select Specific Vendors
            </button>
          </div>

          {compareMode === 'selected' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendors.map((vendor) => (
                <label key={vendor.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedVendors.includes(vendor.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedVendors([...selectedVendors, vendor.id]);
                      } else {
                        setSelectedVendors(selectedVendors.filter(id => id !== vendor.id));
                      }
                    }}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{vendor.name}</div>
                    <div className="text-sm text-gray-500">{vendor.ingredients.length} ingredients</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {compareMode === 'all' && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-blue-800">
                <span className="font-semibold">All Vendors Mode:</span> Comparing all {vendors.length} vendors. 
                Vendors will be ranked by ingredient coverage and cost.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SKU Recipe Details */}
      {selectedSKU && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">SKU Recipe Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">SKU Name</p>
              <p className="font-semibold">{skus.find(s => s.id == selectedSKU)?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Target Weight</p>
              <p className="font-semibold">{skus.find(s => s.id == selectedSKU)?.targetWeightPerSachet}g per sachet</p>
            </div>
          </div>
          
          {getSKURecipe(selectedSKU).length > 0 ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Recipe Ingredients</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {getSKURecipe(selectedSKU).map((ingredient, index) => (
                  <div key={index} className="bg-white p-3 rounded border">
                    <p className="font-medium">{ingredient.ingredientName}</p>
                    <p className="text-sm text-gray-600">{ingredient.gramsPerSachet}g per sachet</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-yellow-800">This SKU has no recipe ingredients. Please add ingredients in SKU Management first.</p>
            </div>
          )}
        </div>
      )}

      {/* Side-by-Side Vendor Comparison */}
      {selectedSKU && vendorCosts.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">Vendor Comparison</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3 sticky left-0 bg-gray-100 z-10">Ingredient</th>
                  {vendorCosts.map((vendor, index) => (
                    <th key={vendor.vendorId} className={`text-center p-3 min-w-[140px] ${
                      index === 0 ? 'bg-green-50' : ''
                    }`}>
                      <div className="font-semibold">{vendor.vendorName}</div>
                      <div className="text-xs text-gray-600">
                        {vendor.availableCount}/{vendor.totalIngredients} ingredients
                      </div>
                      <div className="text-xs font-semibold text-blue-600">
                        {vendor.coveragePercentage.toFixed(0)}% coverage
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getSKURecipe(selectedSKU).map((ingredient, index) => {
                  // Find the cheapest price for this ingredient among all vendors
                  const availablePrices = vendorCosts
                    .filter(v => v.ingredients.find(ing => 
                      matchIngredient(ingredient.ingredientName, ing.name) && !ing.unavailable
                    ))
                    .map(v => v.ingredients.find(ing => 
                      matchIngredient(ingredient.ingredientName, ing.name)
                    ))
                    .filter(Boolean);
                  const cheapestPrice = availablePrices.length > 0 ? Math.min(...availablePrices.map(p => p.cost)) : 0;
                  
                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium sticky left-0 bg-white z-10">
                        {ingredient.ingredientName}
                        <div className="text-xs text-gray-600">{ingredient.gramsPerSachet}g</div>
                      </td>
                      {vendorCosts.map((vendor, vendorIndex) => {
                        const vendorIngredient = vendor.ingredients?.find(ing => 
                          matchIngredient(ingredient.ingredientName, ing.name)
                        );
                        const isCheapest = vendorIngredient && !vendorIngredient.unavailable && vendorIngredient.cost === cheapestPrice;
                        const isUnavailable = vendorIngredient?.unavailable;
                        
                        return (
                          <td key={vendor.vendorId} className={`p-3 text-center ${
                            vendorIndex === 0 ? 'bg-green-50' : ''
                          }`}>
                            {!isUnavailable && vendorIngredient ? (
                              <div>
                                <div className="font-semibold">₹{vendorIngredient.cost.toFixed(2)}</div>
                                <div className="text-xs text-gray-600">
                                  ₹{vendorIngredient.pricePerGram.toFixed(2)}/g
                                </div>
                                {isCheapest && (
                                  <div className="text-xs text-green-600 font-semibold">Best Price</div>
                                )}
                                {!isCheapest && cheapestPrice > 0 && (
                                  <div className="text-xs text-orange-600">
                                    +{((vendorIngredient.cost - cheapestPrice) / cheapestPrice * 100).toFixed(0)}%
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-red-500 text-xs">Not Available</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                
                {/* Coverage Summary Row */}
                <tr className="border-t border-gray-300 bg-blue-50 font-semibold">
                  <td className="p-3 sticky left-0 bg-blue-50 z-10">COVERAGE SUMMARY</td>
                  {vendorCosts.map((vendor, index) => (
                    <td key={vendor.vendorId} className={`p-3 text-center ${
                      index === 0 ? 'bg-green-100' : ''
                    }`}>
                      <div className="text-sm">
                        <div className="font-semibold">{vendor.availableCount}/{vendor.totalIngredients}</div>
                        <div className="text-xs text-blue-600">{vendor.coveragePercentage.toFixed(0)}%</div>
                      </div>
                    </td>
                  ))}
                </tr>
                
                {/* Total Cost Row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <td className="p-3 sticky left-0 bg-gray-50 z-10">TOTAL COST PER SACHET</td>
                  {vendorCosts.map((vendor, index) => {
                    const canSupplyAll = vendor.canSupplyAll;
                    const completeVendors = vendorCosts.filter(v => v.canSupplyAll);
                    const isCheapest = canSupplyAll && completeVendors.length > 0 && 
                      completeVendors.every(v => v.costPerSachet >= vendor.costPerSachet);
                    const isMostExpensive = canSupplyAll && completeVendors.length > 0 && 
                      completeVendors.every(v => v.costPerSachet <= vendor.costPerSachet);
                    
                    return (
                      <td key={vendor.vendorId} className={`p-3 text-center ${
                        isCheapest ? 'bg-green-100' : ''
                      }`}>
                        {canSupplyAll ? (
                          <div>
                            <div className="text-lg font-bold">₹{vendor.costPerSachet.toFixed(2)}</div>
                            {isCheapest && (
                              <div className="text-xs text-green-600 font-semibold">Lowest Total Cost</div>
                            )}
                            {isMostExpensive && !isCheapest && (
                              <div className="text-xs text-red-600">Highest Total Cost</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-red-500">Partial Supply Only</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Recommendations */}
          {vendorCosts.length > 0 && (
            <div className="mt-6 space-y-4">
              {/* Best Complete Supplier */}
              {cheapestVendor && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-800">🏆 Best Complete Supplier</h3>
                  </div>
                  <p className="text-green-700">
                    <span className="font-semibold">{cheapestVendor.vendorName}</span> can supply all ingredients at{' '}
                    <span className="font-bold text-lg">₹{cheapestVendor.costPerSachet.toFixed(2)}</span> per sachet.
                    {mostExpensiveVendor && mostExpensiveVendor.vendorId !== cheapestVendor.vendorId && (
                      <span> You save <span className="font-bold">₹{(mostExpensiveVendor.costPerSachet - cheapestVendor.costPerSachet).toFixed(2)}</span> per sachet compared to the most expensive option.</span>
                    )}
                  </p>
                </div>
              )}

              {/* Partial Suppliers Analysis */}
              {vendorCosts.filter(v => !v.canSupplyAll && v.availableCount > 0).length > 0 && (
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h3 className="font-semibold text-orange-800 mb-2">⚠️ Partial Suppliers</h3>
                  <p className="text-orange-700 mb-3">These vendors can supply some ingredients but not all:</p>
                  <div className="space-y-2">
                    {vendorCosts.filter(v => !v.canSupplyAll && v.availableCount > 0).map(vendor => (
                      <div key={vendor.vendorId} className="flex justify-between items-center bg-white p-2 rounded">
                        <span className="font-medium">{vendor.vendorName}</span>
                        <span className="text-sm text-orange-600">
                          {vendor.availableCount}/{vendor.totalIngredients} ingredients ({vendor.coveragePercentage.toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 Analysis Summary</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• {vendorCosts.filter(v => v.canSupplyAll).length} vendors can supply all ingredients</li>
                    <li>• {vendorCosts.filter(v => !v.canSupplyAll && v.availableCount > 0).length} vendors can supply partially</li>
                    <li>• {vendorCosts.filter(v => v.availableCount === 0).length} vendors cannot supply any ingredients</li>
                    {cheapestVendor && mostExpensiveVendor && (
                      <li>• Price range: ₹{cheapestVendor.costPerSachet.toFixed(2)} - ₹{mostExpensiveVendor.costPerSachet.toFixed(2)}</li>
                    )}
                  </ul>
                </div>
                
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Considerations</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Check vendor reliability and delivery times</li>
                    <li>• Consider minimum order quantities</li>
                    <li>• Verify ingredient quality ratings</li>
                    <li>• Factor in shipping costs if applicable</li>
                    <li>• Consider mixing vendors for best prices</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
