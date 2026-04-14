import React, { useState } from 'react';
import { DollarSign, TrendingUp, Package, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Determine what pack types a SKU supports based on its type
function getPackTypesForSKU(sku) {
  if (!sku) return [];
  const skuType = sku.skuType || 'weekly';
  const name = (sku.name || '').toLowerCase();

  if (skuType === 'single') {
    // Weight-based products (Date Bytes, Black Royal Dates)
    return [
      { value: '0.5kg', label: '500g Pack' },
      { value: '1kg', label: '1 Kg Pack' },
    ];
  }
  if (name.includes('seed cycle')) {
    // Seed Cycle: 2 pouches for a monthly cycle
    return [
      { value: 'monthly', label: 'Monthly Cycle (2 pouches)' },
    ];
  }
  // Regular sachet-based (Day Pack, Night Soak)
  return [
    { value: 'weekly', label: 'Weekly Pack (7 sachets)' },
    { value: 'monthly', label: 'Monthly Pack (28 sachets)' },
  ];
}

function getPackLabel(packType) {
  const labels = { weekly: 'Weekly', monthly: 'Monthly', '0.5kg': '500g', '1kg': '1kg' };
  return labels[packType] || packType;
}

export default function PricingStrategy() {
  const { state, dispatch, showToast } = useApp();
  const { skus, pricingStrategies } = state || { skus: [], pricingStrategies: [] };

  // Safety check - ensure state is available
  if (!state) {
    return <div className="p-6">Loading...</div>;
  }

  const [selectedSKU, setSelectedSKU] = useState(null);
  const [packType, setPackType] = useState('weekly');
  const [formData, setFormData] = useState({
    sachetPackagingCost: '',
    packBoxCost: '',
    operatingCost: '',
    marketingCost: '',
    shippingCost: '',
    otherCosts: '',
    profitMargin: 30,
    sellingPrice: '',
  });

  const [manualPricing, setManualPricing] = useState(false);

  const availablePackTypes = getPackTypesForSKU(selectedSKU);
  const isSingleUnit = selectedSKU?.skuType === 'single';
  const isSeedCycle = (selectedSKU?.name || '').toLowerCase().includes('seed cycle');

  const loadExistingPricing = (skuId, pt) => {
    const existingPricing = pricingStrategies.find(
      (p) => String(p.skuId) === String(skuId) && p.packType === pt
    );
    if (existingPricing) {
      setFormData({
        sachetPackagingCost: existingPricing.sachetPackagingCost,
        packBoxCost: existingPricing.packBoxCost,
        operatingCost: existingPricing.operatingCost,
        marketingCost: existingPricing.marketingCost,
        shippingCost: existingPricing.shippingCost,
        otherCosts: existingPricing.otherCosts,
        volatilityBuffer: existingPricing.volatilityBuffer,
        profitMargin: existingPricing.profitMargin,
        sellingPrice: existingPricing.sellingPrice,
      });
    } else {
      setFormData({
        sachetPackagingCost: '',
        packBoxCost: '',
        operatingCost: '',
        marketingCost: '',
        shippingCost: '',
        otherCosts: '',
        volatilityBuffer: '',
        profitMargin: 30,
        sellingPrice: '',
      });
    }
  };

  const handleSKUChange = (skuId) => {
    const sku = skus.find((s) => String(s.id) === String(skuId));
    setSelectedSKU(sku);

    // Auto-select first available pack type for this SKU
    const packTypes = getPackTypesForSKU(sku);
    const defaultPack = packTypes[0]?.value || 'weekly';
    setPackType(defaultPack);
    loadExistingPricing(skuId, defaultPack);
  };

  const handlePackTypeChange = (newPackType) => {
    setPackType(newPackType);
    if (selectedSKU) {
      loadExistingPricing(selectedSKU.id, newPackType);
    }
  };

  const getRawMaterialCost = () => {
    if (!selectedSKU) return 0;
    if (isSingleUnit) {
      // For single unit SKUs, raw material cost from singleUnitIngredients
      const ingredients = selectedSKU.singleUnitIngredients || [];
      return ingredients.reduce((sum, ing) => {
        const costPerKg = parseFloat(ing.pricePerUnit || 0);
        const gramsUsed = parseFloat(ing.gramsPerUnit || 0);
        return sum + (costPerKg * gramsUsed / 1000);
      }, 0);
    }
    if (isSeedCycle) {
      // Seed Cycle: monthly cost (both phases)
      return selectedSKU.monthlyPack?.rawMaterialCost || 0;
    }
    return packType === 'weekly'
      ? (selectedSKU.weeklyPack?.rawMaterialCost || 0)
      : (selectedSKU.monthlyPack?.rawMaterialCost || 0);
  };

  const getUnitsCount = () => {
    if (isSingleUnit) return 1; // 1 unit (500g or 1kg pack)
    if (isSeedCycle) return 2; // 2 pouches per monthly cycle
    return packType === 'weekly' ? 7 : 28;
  };

  const getUnitLabel = () => {
    if (isSingleUnit) return 'pack';
    if (isSeedCycle) return 'pouches';
    return 'sachets';
  };

  const calculateTotalCost = () => {
    const rawMaterial = getRawMaterialCost();
    const units = getUnitsCount();
    const sachetPkg = parseFloat(formData.sachetPackagingCost || 0) * units;
    const packBox = parseFloat(formData.packBoxCost || 0);
    const operating = parseFloat(formData.operatingCost || 0);
    const marketing = parseFloat(formData.marketingCost || 0);
    const shipping = parseFloat(formData.shippingCost || 0);
    const other = parseFloat(formData.otherCosts || 0);
    const buffer = parseFloat(formData.volatilityBuffer || 0);

    return rawMaterial + buffer + sachetPkg + packBox + operating + marketing + shipping + other;
  };

  const calculateSuggestedPrice = () => {
    const totalCost = calculateTotalCost();
    const margin = parseFloat(formData.profitMargin || 0) / 100;
    return totalCost * (1 + margin);
  };

  const calculateProfitFromSellingPrice = () => {
    const totalCost = calculateTotalCost();
    const selling = parseFloat(formData.sellingPrice || 0);
    const profit = selling - totalCost;
    const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    return { profit, profitMargin };
  };

  const handleSavePricing = () => {
    if (!selectedSKU) {
      showToast('Please select a SKU', 'error');
      return;
    }

    const totalCost = calculateTotalCost();
    let finalSellingPrice, finalProfitMargin, finalProfitAmount;

    if (manualPricing && formData.sellingPrice) {
      finalSellingPrice = parseFloat(formData.sellingPrice);
      const { profit, profitMargin } = calculateProfitFromSellingPrice();
      finalProfitAmount = profit;
      finalProfitMargin = profitMargin;
    } else {
      finalSellingPrice = calculateSuggestedPrice();
      finalProfitMargin = parseFloat(formData.profitMargin || 0);
      finalProfitAmount = finalSellingPrice - totalCost;
    }

    const pricingData = {
      id: Date.now(),
      skuId: selectedSKU.id,
      skuName: selectedSKU.name,
      packType,
      rawMaterialCost: getRawMaterialCost(),
      sachetPackagingCost: parseFloat(formData.sachetPackagingCost || 0),
      packBoxCost: parseFloat(formData.packBoxCost || 0),
      operatingCost: parseFloat(formData.operatingCost || 0),
      marketingCost: parseFloat(formData.marketingCost || 0),
      shippingCost: parseFloat(formData.shippingCost || 0),
      otherCosts: parseFloat(formData.otherCosts || 0),
      volatilityBuffer: parseFloat(formData.volatilityBuffer || 0),
      totalCost,
      profitMargin: finalProfitMargin,
      profitAmount: finalProfitAmount,
      sellingPrice: finalSellingPrice,
    };

    // Check if pricing already exists
    const existingIndex = pricingStrategies.findIndex(
      (p) => String(p.skuId) === String(selectedSKU.id) && p.packType === packType
    );

    if (existingIndex >= 0) {
      dispatch({
        type: 'UPDATE_PRICING',
        payload: { ...pricingData, id: pricingStrategies[existingIndex].id },
      });
      showToast('Pricing strategy updated', 'success');
    } else {
      dispatch({ type: 'ADD_PRICING', payload: pricingData });
      showToast('Pricing strategy saved', 'success');
    }
  };

  const totalCost = calculateTotalCost();
  const suggestedPrice = calculateSuggestedPrice();
  const profitFromManualPrice = manualPricing ? calculateProfitFromSellingPrice() : null;

  // Get pricing for comparison (only for weekly/monthly SKUs)
  const weeklyPricing = selectedSKU ? pricingStrategies.find(
    (p) => String(p.skuId) === String(selectedSKU.id) && p.packType === 'weekly'
  ) : null;
  const monthlyPricing = selectedSKU ? pricingStrategies.find(
    (p) => String(p.skuId) === String(selectedSKU.id) && p.packType === 'monthly'
  ) : null;

  // Price Book - group pricing by SKU with appropriate pack types
  const priceBookData = skus.map(sku => {
    const packTypes = getPackTypesForSKU(sku);
    const prices = {};
    packTypes.forEach(pt => {
      prices[pt.value] = pricingStrategies.find(p => String(p.skuId) === String(sku.id) && p.packType === pt.value);
    });
    return { sku, packTypes, prices };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pricing Strategy</h1>
        <p className="text-gray-600 mt-1">Set costs and profit margins for your products</p>
      </div>

      {/* Price Book - All SKUs at a Glance */}
      {skus.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-teal-600" />
            <h2 className="text-xl font-bold text-gray-900">Price Book</h2>
            <span className="text-xs text-gray-500 ml-2">All products at a glance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3 font-semibold">Product</th>
                  <th className="text-left p-3 font-semibold">Type</th>
                  <th className="text-right p-3 font-semibold">Price 1</th>
                  <th className="text-right p-3 font-semibold">Margin</th>
                  <th className="text-right p-3 font-semibold">Price 2</th>
                  <th className="text-right p-3 font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {priceBookData.map(({ sku, packTypes, prices }) => (
                  <tr key={sku.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">{sku.name}</td>
                    <td className="p-3">
                      <span className="text-xs text-gray-500">
                        {(sku.skuType === 'single') ? 'Weight' : (sku.name || '').toLowerCase().includes('seed cycle') ? 'Cycle' : 'Sachet'}
                      </span>
                    </td>
                    {packTypes.length >= 1 ? (
                      <>
                        <td className="p-3 text-right">
                          {prices[packTypes[0].value] ? (
                            <div>
                              <span className="font-semibold text-green-700">₹{prices[packTypes[0].value].sellingPrice.toFixed(0)}</span>
                              <span className="block text-xs text-gray-400">{packTypes[0].label}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-gray-400 text-xs">Not set</span>
                              <span className="block text-xs text-gray-300">{packTypes[0].label}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {prices[packTypes[0].value] ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${prices[packTypes[0].value].profitMargin >= 20 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {prices[packTypes[0].value].profitMargin.toFixed(0)}%
                            </span>
                          ) : '-'}
                        </td>
                      </>
                    ) : (
                      <><td className="p-3">-</td><td className="p-3">-</td></>
                    )}
                    {packTypes.length >= 2 ? (
                      <>
                        <td className="p-3 text-right">
                          {prices[packTypes[1].value] ? (
                            <div>
                              <span className="font-semibold text-blue-700">₹{prices[packTypes[1].value].sellingPrice.toFixed(0)}</span>
                              <span className="block text-xs text-gray-400">{packTypes[1].label}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-gray-400 text-xs">Not set</span>
                              <span className="block text-xs text-gray-300">{packTypes[1].label}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {prices[packTypes[1].value] ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${prices[packTypes[1].value].profitMargin >= 20 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {prices[packTypes[1].value].profitMargin.toFixed(0)}%
                            </span>
                          ) : '-'}
                        </td>
                      </>
                    ) : (
                      <><td className="p-3 text-center text-gray-300">-</td><td className="p-3 text-center text-gray-300">-</td></>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {priceBookData.some(d => d.packTypes.some(pt => !d.prices[pt.value])) && (
            <p className="text-xs text-amber-600 mt-3">Some products don't have pricing set yet. Select a SKU below to configure.</p>
          )}
        </div>
      )}

      {/* SKU and Pack Type Selection */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
            <label className="label">Select SKU</label>
            <select
              value={selectedSKU?.id || ''}
              onChange={(e) => handleSKUChange(e.target.value)}
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
          <div>
            <label className="label">Pack Type</label>
            <div className="flex gap-2">
              {availablePackTypes.map((pt, i) => (
                <button
                  key={pt.value}
                  onClick={() => handlePackTypeChange(pt.value)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${packType === pt.value
                    ? (i === 0 ? 'bg-primary text-white' : 'bg-accent text-white')
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  {pt.label}
                </button>
              ))}
              {availablePackTypes.length === 0 && (
                <p className="text-sm text-gray-400 py-2">Select a SKU first</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedSKU && (
        <>
          {/* Cost Breakdown */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Cost Breakdown</h2>

            <div className="space-y-6">
              {/* Raw Material Cost (Read-only) */}
              <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
                <label className="label text-primary-800">Raw Material Cost (Auto-calculated)</label>
                <div className="text-2xl font-bold text-primary-700">
                  ₹{getRawMaterialCost().toFixed(2)}
                </div>
                <p className="text-sm text-primary-600 mt-1">
                  {isSingleUnit
                    ? `Based on ${packType} unit ingredients`
                    : isSeedCycle
                      ? 'Based on recipe for 2 pouches (monthly cycle)'
                      : `Based on recipe for ${getUnitsCount()} ${getUnitLabel()}`
                  }
                </p>
              </div>

              {/* Volatility Buffer */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <label className="label text-orange-800">Volatility Buffer (Safety Margin)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-orange-500">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.volatilityBuffer || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, volatilityBuffer: e.target.value })
                    }
                    className="input-field pl-8 border-orange-300 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-orange-600 mt-1">
                  Add buffer for price fluctuations (e.g. 10% of raw material)
                </p>
              </div>

              {/* Other Costs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="label">
                    {isSingleUnit ? 'Packaging Cost (per unit)' : isSeedCycle ? 'Pouch Packaging Cost (per pouch)' : 'Sachet Packaging Cost (per sachet)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sachetPackagingCost}
                      onChange={(e) =>
                        setFormData({ ...formData, sachetPackagingCost: e.target.value })
                      }
                      className="input-field pl-8"
                      placeholder="2.00"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Total: ₹{(parseFloat(formData.sachetPackagingCost || 0) * getUnitsCount()).toFixed(2)} ({getUnitsCount()} {getUnitLabel()})
                  </p>
                </div>

                <div>
                  <label className="label">{isSingleUnit ? 'Bag/Container Cost' : 'Pack Box/Bag Cost'}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.packBoxCost}
                      onChange={(e) => setFormData({ ...formData, packBoxCost: e.target.value })}
                      className="input-field pl-8"
                      placeholder="15.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Labor/Operating Cost per Pack</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.operatingCost}
                      onChange={(e) => setFormData({ ...formData, operatingCost: e.target.value })}
                      className="input-field pl-8"
                      placeholder="10.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Marketing Cost per Pack</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.marketingCost}
                      onChange={(e) =>
                        setFormData({ ...formData, marketingCost: e.target.value })
                      }
                      className="input-field pl-8"
                      placeholder="5.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Shipping/Delivery Cost per Pack</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.shippingCost}
                      onChange={(e) =>
                        setFormData({ ...formData, shippingCost: e.target.value })
                      }
                      className="input-field pl-8"
                      placeholder="20.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Other Costs</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.otherCosts}
                      onChange={(e) => setFormData({ ...formData, otherCosts: e.target.value })}
                      className="input-field pl-8"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Total Cost */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">
                    Total Cost per {isSingleUnit ? packType : isSeedCycle ? 'Monthly Cycle' : 'Pack'}
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    ₹{totalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Profit Calculation */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Profit Calculation</h2>

            <div className="flex items-center gap-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!manualPricing}
                  onChange={() => setManualPricing(false)}
                  className="w-4 h-4 text-primary"
                />
                <span className="font-medium">Set Profit Margin %</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={manualPricing}
                  onChange={() => setManualPricing(true)}
                  className="w-4 h-4 text-primary"
                />
                <span className="font-medium">Enter Selling Price</span>
              </label>
            </div>

            {!manualPricing ? (
              <div className="space-y-4">
                <div>
                  <label className="label">
                    Desired Profit Margin: {formData.profitMargin}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.profitMargin}
                    onChange={(e) =>
                      setFormData({ ...formData, profitMargin: e.target.value })
                    }
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Cost:</span>
                      <span className="font-semibold">₹{totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Profit Margin:</span>
                      <span className="font-semibold">{formData.profitMargin}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Profit Amount:</span>
                      <span className="font-semibold text-green-600">
                        ₹{(suggestedPrice - totalCost).toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Suggested Selling Price:</span>
                      <span className="text-3xl font-bold text-green-600">
                        ₹{suggestedPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label">Enter Selling Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) =>
                        setFormData({ ...formData, sellingPrice: e.target.value })
                      }
                      className="input-field pl-8 text-2xl font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {formData.sellingPrice && (
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Total Cost:</span>
                        <span className="font-semibold">₹{totalCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Selling Price:</span>
                        <span className="font-semibold">₹{parseFloat(formData.sellingPrice).toFixed(2)}</span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-lg font-bold text-gray-900">Profit:</span>
                          <span
                            className={`text-2xl font-bold ${profitFromManualPrice.profit >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                          >
                            ₹{profitFromManualPrice.profit.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Profit Margin:</span>
                          <span
                            className={`text-xl font-semibold ${profitFromManualPrice.profitMargin >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                              }`}
                          >
                            {profitFromManualPrice.profitMargin.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={handleSavePricing} className="btn-primary mt-6 w-full flex items-center justify-center gap-2">
              <Save className="w-5 h-5" />
              Save Pricing Strategy
            </button>
          </div>

          {/* Comparison View - only for weekly/monthly SKUs */}
          {!isSingleUnit && !isSeedCycle && weeklyPricing && monthlyPricing && (
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Pricing Comparison</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-bold text-blue-900">Weekly Pack</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-semibold">₹{(weeklyPricing.totalCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Selling Price:</span>
                      <span className="font-semibold">₹{(weeklyPricing.sellingPrice || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profit:</span>
                      <span className="font-semibold text-green-600">
                        ₹{(weeklyPricing.profitAmount || 0).toFixed(2)} ({(weeklyPricing.profitMargin || 0).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-accent-50 p-6 rounded-lg border border-accent-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-6 h-6 text-accent-600" />
                    <h3 className="text-lg font-bold text-accent-900">Monthly Pack</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cost:</span>
                      <span className="font-semibold">₹{(monthlyPricing.totalCost || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Selling Price:</span>
                      <span className="font-semibold">₹{(monthlyPricing.sellingPrice || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profit:</span>
                      <span className="font-semibold text-green-600">
                        ₹{(monthlyPricing.profitAmount || 0).toFixed(2)} ({(monthlyPricing.profitMargin || 0).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <h4 className="font-bold text-green-900">Customer Savings</h4>
                </div>
                <p className="text-sm text-gray-700">
                  If customer buys monthly pack instead of 4 weekly packs:{' '}
                  <span className="font-bold text-green-600">
                    ₹{((weeklyPricing.sellingPrice || 0) * 4 - (monthlyPricing.sellingPrice || 0)).toFixed(2)} savings
                  </span>
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Your profit difference:{' '}
                  <span className="font-bold">
                    ₹{((monthlyPricing.profitAmount || 0) - (weeklyPricing.profitAmount || 0) * 4).toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Saved Pricing Strategies */}
      {pricingStrategies.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Saved Pricing Strategies</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3">SKU</th>
                  <th className="text-left p-3">Pack Type</th>
                  <th className="text-right p-3">Total Cost</th>
                  <th className="text-right p-3">Selling Price</th>
                  <th className="text-right p-3">Profit</th>
                  <th className="text-right p-3">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {pricingStrategies.map((pricing) => (
                  <tr key={pricing.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{pricing.skuName}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          pricing.packType === 'weekly' ? 'bg-blue-100 text-blue-700'
                          : pricing.packType === 'monthly' ? 'bg-accent-100 text-accent-700'
                          : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {getPackLabel(pricing.packType)}
                      </span>
                    </td>
                    <td className="p-3 text-right">₹{(pricing.totalCost || 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold">₹{(pricing.sellingPrice || 0).toFixed(2)}</td>
                    <td className="p-3 text-right text-green-600 font-semibold">
                      ₹{(pricing.profitAmount || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {(pricing.profitMargin || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
