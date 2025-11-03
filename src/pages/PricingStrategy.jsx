import React, { useState } from 'react';
import { DollarSign, TrendingUp, Package, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function PricingStrategy() {
  const { state, dispatch, showToast } = useApp();
  const { skus, pricingStrategies } = state;

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

  const handleSKUChange = (skuId) => {
    const sku = skus.find((s) => String(s.id) === String(skuId));
    setSelectedSKU(sku);
    
    // Check if pricing exists for this SKU and pack type
    const existingPricing = pricingStrategies.find(
      (p) => String(p.skuId) === String(skuId) && p.packType === packType
    );

    if (existingPricing) {
      setFormData({
        sachetPackagingCost: existingPricing.sachetPackagingCost,
        packBoxCost: existingPricing.packBoxCost,
        operatingCost: existingPricing.operatingCost,
        marketingCost: existingPricing.marketingCost,
        shippingCost: existingPricing.shippingCost,
        otherCosts: existingPricing.otherCosts,
        profitMargin: existingPricing.profitMargin,
        sellingPrice: existingPricing.sellingPrice,
      });
    } else {
      // Reset to defaults
      setFormData({
        sachetPackagingCost: '',
        packBoxCost: '',
        operatingCost: '',
        marketingCost: '',
        shippingCost: '',
        otherCosts: '',
        profitMargin: 30,
        sellingPrice: '',
      });
    }
  };

  const handlePackTypeChange = (newPackType) => {
    setPackType(newPackType);
    if (selectedSKU) {
      const existingPricing = pricingStrategies.find(
        (p) => String(p.skuId) === String(selectedSKU.id) && p.packType === newPackType
      );

      if (existingPricing) {
        setFormData({
          sachetPackagingCost: existingPricing.sachetPackagingCost,
          packBoxCost: existingPricing.packBoxCost,
          operatingCost: existingPricing.operatingCost,
          marketingCost: existingPricing.marketingCost,
          shippingCost: existingPricing.shippingCost,
          otherCosts: existingPricing.otherCosts,
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
          profitMargin: 30,
          sellingPrice: '',
        });
      }
    }
  };

  const getRawMaterialCost = () => {
    if (!selectedSKU) return 0;
    return packType === 'weekly'
      ? selectedSKU.weeklyPack.rawMaterialCost
      : selectedSKU.monthlyPack.rawMaterialCost;
  };

  const getSachetsCount = () => {
    return packType === 'weekly' ? 7 : 28;
  };

  const calculateTotalCost = () => {
    const rawMaterial = getRawMaterialCost();
    const sachets = getSachetsCount();
    const sachetPkg = parseFloat(formData.sachetPackagingCost || 0) * sachets;
    const packBox = parseFloat(formData.packBoxCost || 0);
    const operating = parseFloat(formData.operatingCost || 0);
    const marketing = parseFloat(formData.marketingCost || 0);
    const shipping = parseFloat(formData.shippingCost || 0);
    const other = parseFloat(formData.otherCosts || 0);

    return rawMaterial + sachetPkg + packBox + operating + marketing + shipping + other;
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

  // Get pricing for comparison
  const weeklyPricing = selectedSKU ? pricingStrategies.find(
    (p) => String(p.skuId) === String(selectedSKU.id) && p.packType === 'weekly'
  ) : null;
  const monthlyPricing = selectedSKU ? pricingStrategies.find(
    (p) => String(p.skuId) === String(selectedSKU.id) && p.packType === 'monthly'
  ) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pricing Strategy</h1>
        <p className="text-gray-600 mt-1">Set costs and profit margins for your products</p>
      </div>

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
              <button
                onClick={() => handlePackTypeChange('weekly')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  packType === 'weekly'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Weekly Pack (7 sachets)
              </button>
              <button
                onClick={() => handlePackTypeChange('monthly')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  packType === 'monthly'
                    ? 'bg-accent text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Monthly Pack (28 sachets)
              </button>
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
                  Based on recipe for {getSachetsCount()} sachets
                </p>
              </div>

              {/* Other Costs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="label">Sachet Packaging Cost (per sachet)</label>
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
                    Total: ₹{(parseFloat(formData.sachetPackagingCost || 0) * getSachetsCount()).toFixed(2)}
                  </p>
                </div>

                <div>
                  <label className="label">Pack Box/Bag Cost</label>
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
                  <span className="text-lg font-semibold text-gray-900">Total Cost per Pack</span>
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
                            className={`text-2xl font-bold ${
                              profitFromManualPrice.profit >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            ₹{profitFromManualPrice.profit.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">Profit Margin:</span>
                          <span
                            className={`text-xl font-semibold ${
                              profitFromManualPrice.profitMargin >= 0
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

          {/* Comparison View */}
          {weeklyPricing && monthlyPricing && (
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
                      <span className="font-semibold">₹{weeklyPricing.totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Selling Price:</span>
                      <span className="font-semibold">₹{weeklyPricing.sellingPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profit:</span>
                      <span className="font-semibold text-green-600">
                        ₹{weeklyPricing.profitAmount.toFixed(2)} ({weeklyPricing.profitMargin.toFixed(1)}%)
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
                      <span className="font-semibold">₹{monthlyPricing.totalCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Selling Price:</span>
                      <span className="font-semibold">₹{monthlyPricing.sellingPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Profit:</span>
                      <span className="font-semibold text-green-600">
                        ₹{monthlyPricing.profitAmount.toFixed(2)} ({monthlyPricing.profitMargin.toFixed(1)}%)
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
                    ₹{(weeklyPricing.sellingPrice * 4 - monthlyPricing.sellingPrice).toFixed(2)} savings
                  </span>
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Your profit difference:{' '}
                  <span className="font-bold">
                    ₹{(monthlyPricing.profitAmount - weeklyPricing.profitAmount * 4).toFixed(2)}
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
                          pricing.packType === 'weekly'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-accent-100 text-accent-700'
                        }`}
                      >
                        {pricing.packType === 'weekly' ? 'Weekly' : 'Monthly'}
                      </span>
                    </td>
                    <td className="p-3 text-right">₹{pricing.totalCost.toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold">₹{pricing.sellingPrice.toFixed(2)}</td>
                    <td className="p-3 text-right text-green-600 font-semibold">
                      ₹{pricing.profitAmount.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {pricing.profitMargin.toFixed(1)}%
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
