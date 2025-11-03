import React, { useState } from 'react';
import { Plus, Trash2, TrendingUp, Download, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function SalesRevenue() {
  const { state, dispatch, showToast } = useApp();
  const { skus, pricingStrategies, salesTargets } = state;

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [fixedCosts, setFixedCosts] = useState({
    rent: '',
    salaries: '',
    utilities: '',
    other: '',
  });

  const [targetRows, setTargetRows] = useState([]);
  const [newRow, setNewRow] = useState({
    skuId: '',
    packType: 'weekly',
    targetUnits: '',
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleAddRow = () => {
    if (!newRow.skuId || !newRow.targetUnits) {
      showToast('Please select SKU and enter target units', 'error');
      return;
    }

    const sku = skus.find((s) => s.id == newRow.skuId);
    const pricing = pricingStrategies.find(
      (p) => p.skuId == newRow.skuId && p.packType === newRow.packType
    );

    if (!sku) {
      showToast('SKU not found', 'error');
      return;
    }

    if (!pricing) {
      showToast('Please set pricing for this SKU and pack type first', 'error');
      return;
    }

    const targetUnits = parseInt(newRow.targetUnits);
    const projectedRevenue = pricing.sellingPrice * targetUnits;
    const projectedProfit = pricing.profitAmount * targetUnits;

    const row = {
      id: Date.now() + Math.random(),
      skuId: sku.id,
      skuName: sku.name,
      packType: newRow.packType,
      targetUnits,
      sellingPrice: pricing.sellingPrice,
      costPerUnit: pricing.totalCost,
      profitPerUnit: pricing.profitAmount,
      profitMargin: pricing.profitMargin,
      projectedRevenue,
      projectedProfit,
    };

    setTargetRows([...targetRows, row]);
    setNewRow({ skuId: '', packType: 'weekly', targetUnits: '' });
    showToast('Target row added', 'success');
  };

  const handleRemoveRow = (rowId) => {
    setTargetRows(targetRows.filter((row) => row.id !== rowId));
  };

  const handleSaveTargets = () => {
    if (targetRows.length === 0) {
      showToast('Please add at least one target row', 'error');
      return;
    }

    const targetData = {
      id: Date.now(),
      month: selectedMonth,
      year: selectedYear,
      targets: targetRows,
      fixedCosts: {
        rent: parseFloat(fixedCosts.rent || 0),
        salaries: parseFloat(fixedCosts.salaries || 0),
        utilities: parseFloat(fixedCosts.utilities || 0),
        other: parseFloat(fixedCosts.other || 0),
      },
    };

    // Check if target exists for this month/year
    const existingIndex = salesTargets.findIndex(
      (t) => t.month === selectedMonth && t.year === selectedYear
    );

    if (existingIndex >= 0) {
      dispatch({
        type: 'UPDATE_SALES_TARGET',
        payload: { ...targetData, id: salesTargets[existingIndex].id },
      });
      showToast('Sales target updated', 'success');
    } else {
      dispatch({ type: 'ADD_SALES_TARGET', payload: targetData });
      showToast('Sales target saved', 'success');
    }
  };

  const calculateSummary = () => {
    const weeklyUnits = targetRows
      .filter((row) => row.packType === 'weekly')
      .reduce((sum, row) => sum + row.targetUnits, 0);

    const monthlyUnits = targetRows
      .filter((row) => row.packType === 'monthly')
      .reduce((sum, row) => sum + row.targetUnits, 0);

    const totalRevenue = targetRows.reduce((sum, row) => sum + row.projectedRevenue, 0);
    const totalProfit = targetRows.reduce((sum, row) => sum + row.projectedProfit, 0);
    const totalCosts = targetRows.reduce((sum, row) => sum + row.costPerUnit * row.targetUnits, 0);
    const averageMargin = totalCosts > 0 ? (totalProfit / totalCosts) * 100 : 0;

    return {
      weeklyUnits,
      monthlyUnits,
      totalRevenue,
      totalProfit,
      averageMargin,
    };
  };

  const calculateBreakEven = () => {
    const totalFixedCosts =
      parseFloat(fixedCosts.rent || 0) +
      parseFloat(fixedCosts.salaries || 0) +
      parseFloat(fixedCosts.utilities || 0) +
      parseFloat(fixedCosts.other || 0);

    if (targetRows.length === 0) {
      return {
        totalFixedCosts,
        weeklyBreakEven: 0,
        monthlyBreakEven: 0,
        breakEvenRevenue: 0,
      };
    }

    // Calculate weighted average profit per unit for weekly and monthly packs
    const weeklyRows = targetRows.filter((row) => row.packType === 'weekly');
    const monthlyRows = targetRows.filter((row) => row.packType === 'monthly');

    const avgWeeklyProfit =
      weeklyRows.length > 0
        ? weeklyRows.reduce((sum, row) => sum + row.profitPerUnit, 0) / weeklyRows.length
        : 0;

    const avgMonthlyProfit =
      monthlyRows.length > 0
        ? monthlyRows.reduce((sum, row) => sum + row.profitPerUnit, 0) / monthlyRows.length
        : 0;

    const weeklyBreakEven = avgWeeklyProfit > 0 ? Math.ceil(totalFixedCosts / avgWeeklyProfit) : 0;
    const monthlyBreakEven = avgMonthlyProfit > 0 ? Math.ceil(totalFixedCosts / avgMonthlyProfit) : 0;

    const avgSellingPrice =
      targetRows.reduce((sum, row) => sum + row.sellingPrice, 0) / targetRows.length;
    const breakEvenRevenue = totalFixedCosts / (1 - (1 / (1 + (avgSellingPrice / (avgSellingPrice - (targetRows.reduce((sum, row) => sum + row.profitPerUnit, 0) / targetRows.length))))));

    return {
      totalFixedCosts,
      weeklyBreakEven,
      monthlyBreakEven,
      breakEvenRevenue: totalFixedCosts,
    };
  };

  const calculateIngredientRequirements = () => {
    const ingredientMap = new Map();

    targetRows.forEach((row) => {
      const sku = skus.find((s) => s.id === row.skuId);
      if (!sku || !sku.recipe || !Array.isArray(sku.recipe)) return;

      const sachetsPerPack = row.packType === 'weekly' ? 7 : 28;
      const totalSachets = row.targetUnits * sachetsPerPack;

      sku.recipe.forEach((item) => {
        const totalGrams = item.gramsPerSachet * totalSachets;
        const totalCost = totalGrams * item.pricePerGram;

        if (ingredientMap.has(item.ingredientName)) {
          const existing = ingredientMap.get(item.ingredientName);
          ingredientMap.set(item.ingredientName, {
            ...existing,
            totalGrams: existing.totalGrams + totalGrams,
            totalCost: existing.totalCost + totalCost,
          });
        } else {
          ingredientMap.set(item.ingredientName, {
            ingredientName: item.ingredientName,
            totalGrams,
            totalKg: totalGrams / 1000,
            pricePerGram: item.pricePerGram,
            totalCost,
            vendorName: item.vendorName,
          });
        }
      });
    });

    return Array.from(ingredientMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  };

  const exportToCSV = () => {
    const summary = calculateSummary();
    const headers = [
      'SKU',
      'Pack Type',
      'Target Units',
      'Selling Price',
      'Cost/Unit',
      'Profit/Unit',
      'Margin %',
      'Revenue',
      'Profit',
    ];

    const rows = targetRows.map((row) => [
      row.skuName,
      row.packType === 'weekly' ? 'Weekly' : 'Monthly',
      row.targetUnits,
      row.sellingPrice.toFixed(2),
      row.costPerUnit.toFixed(2),
      row.profitPerUnit.toFixed(2),
      row.profitMargin.toFixed(2),
      row.projectedRevenue.toFixed(2),
      row.projectedProfit.toFixed(2),
    ]);

    const csvContent = [
      `Sales Target - ${months[selectedMonth]} ${selectedYear}`,
      '',
      headers.join(','),
      ...rows.map((row) => row.join(',')),
      '',
      `Total Weekly Packs,${summary.weeklyUnits}`,
      `Total Monthly Packs,${summary.monthlyUnits}`,
      `Total Revenue,₹${summary.totalRevenue.toFixed(2)}`,
      `Total Profit,₹${summary.totalProfit.toFixed(2)}`,
      `Average Margin,${summary.averageMargin.toFixed(2)}%`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-target-${months[selectedMonth]}-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('CSV exported successfully', 'success');
  };

  const summary = calculateSummary();
  const breakEven = calculateBreakEven();
  const ingredientRequirements = calculateIngredientRequirements();

  // Load existing target if available
  React.useEffect(() => {
    const existingTarget = salesTargets.find(
      (t) => t.month === selectedMonth && t.year === selectedYear
    );

    if (existingTarget) {
      setTargetRows(existingTarget.targets);
      setFixedCosts(existingTarget.fixedCosts || {
        rent: '',
        salaries: '',
        utilities: '',
        other: '',
      });
    } else {
      setTargetRows([]);
      setFixedCosts({ rent: '', salaries: '', utilities: '', other: '' });
    }
  }, [selectedMonth, selectedYear, salesTargets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Target & Revenue</h1>
          <p className="text-gray-600 mt-1">Plan monthly targets and track projections</p>
        </div>
        {targetRows.length > 0 && (
          <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        )}
      </div>

      {/* Month/Year Selection */}
      <div className="card" style={{ overflow: 'visible' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
            <label className="label">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
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
              {months.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
            <label className="label">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
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
              {[2024, 2025, 2026, 2027, 2028].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Monthly Target Setting */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Monthly Targets</h2>

        {/* Target Rows Table */}
        {targetRows.length > 0 && (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3">SKU</th>
                  <th className="text-left p-3">Pack Type</th>
                  <th className="text-right p-3">Target Units</th>
                  <th className="text-right p-3">Price/Unit</th>
                  <th className="text-right p-3">Cost/Unit</th>
                  <th className="text-right p-3">Profit/Unit</th>
                  <th className="text-right p-3">Revenue</th>
                  <th className="text-right p-3">Profit</th>
                  <th className="text-center p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {targetRows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{row.skuName}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.packType === 'weekly'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-accent-100 text-accent-700'
                        }`}
                      >
                        {row.packType === 'weekly' ? 'Weekly' : 'Monthly'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold">{row.targetUnits}</td>
                    <td className="p-3 text-right">₹{row.sellingPrice.toFixed(2)}</td>
                    <td className="p-3 text-right">₹{row.costPerUnit.toFixed(2)}</td>
                    <td className="p-3 text-right text-green-600">
                      ₹{row.profitPerUnit.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      ₹{row.projectedRevenue.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right font-semibold text-green-600">
                      ₹{row.projectedProfit.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Row Form */}
        <div className="bg-blue-50 p-4 rounded-lg" style={{ overflow: 'visible' }}>
          <h3 className="font-semibold text-gray-900 mb-4">Add Target Row</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative" style={{ zIndex: 99999, isolation: 'isolate' }}>
              <label className="label text-sm">SKU</label>
              <select
                value={newRow.skuId}
                onChange={(e) => setNewRow({ ...newRow, skuId: e.target.value })}
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
              <label className="label text-sm">Pack Type</label>
              <select
                value={newRow.packType}
                onChange={(e) => setNewRow({ ...newRow, packType: e.target.value })}
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
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="label text-sm">Target Units</label>
              <input
                type="number"
                value={newRow.targetUnits}
                onChange={(e) => setNewRow({ ...newRow, targetUnits: e.target.value })}
                className="input-field"
                placeholder="100"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddRow}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
            </div>
          </div>
        </div>

        {targetRows.length > 0 && (
          <button
            onClick={handleSaveTargets}
            className="btn-primary mt-6 w-full"
          >
            Save Monthly Targets
          </button>
        )}
      </div>

      {/* Monthly Summary */}
      {targetRows.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Monthly Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600 font-semibold mb-1">Weekly Packs</p>
              <p className="text-3xl font-bold text-blue-700">{summary.weeklyUnits}</p>
            </div>
            <div className="bg-accent-50 p-4 rounded-lg border border-accent-200">
              <p className="text-sm text-accent-600 font-semibold mb-1">Monthly Packs</p>
              <p className="text-3xl font-bold text-accent-700">{summary.monthlyUnits}</p>
            </div>
            <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
              <p className="text-sm text-primary-600 font-semibold mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-primary-700">
                ₹{summary.totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 font-semibold mb-1">Total Profit</p>
              <p className="text-3xl font-bold text-green-700">
                ₹{summary.totalProfit.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Avg Margin: {summary.averageMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Break-even Analysis */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Break-even Analysis</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="label">Monthly Rent</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                ₹
              </span>
              <input
                type="number"
                value={fixedCosts.rent}
                onChange={(e) => setFixedCosts({ ...fixedCosts, rent: e.target.value })}
                className="input-field pl-8"
                placeholder="10000"
              />
            </div>
          </div>
          <div>
            <label className="label">Monthly Salaries</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                ₹
              </span>
              <input
                type="number"
                value={fixedCosts.salaries}
                onChange={(e) => setFixedCosts({ ...fixedCosts, salaries: e.target.value })}
                className="input-field pl-8"
                placeholder="20000"
              />
            </div>
          </div>
          <div>
            <label className="label">Utilities</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                ₹
              </span>
              <input
                type="number"
                value={fixedCosts.utilities}
                onChange={(e) => setFixedCosts({ ...fixedCosts, utilities: e.target.value })}
                className="input-field pl-8"
                placeholder="5000"
              />
            </div>
          </div>
          <div>
            <label className="label">Other Fixed Costs</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                ₹
              </span>
              <input
                type="number"
                value={fixedCosts.other}
                onChange={(e) => setFixedCosts({ ...fixedCosts, other: e.target.value })}
                className="input-field pl-8"
                placeholder="5000"
              />
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Fixed Costs</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{breakEven.totalFixedCosts.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Break-even (Weekly)</p>
              <p className="text-2xl font-bold text-yellow-700">
                {breakEven.weeklyBreakEven} packs
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Break-even (Monthly)</p>
              <p className="text-2xl font-bold text-yellow-700">
                {breakEven.monthlyBreakEven} packs
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Break-even Revenue</p>
              <p className="text-2xl font-bold text-yellow-700">
                ₹{breakEven.breakEvenRevenue.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Raw Material Planning */}
      {ingredientRequirements.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Raw Material Planning for {months[selectedMonth]}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3">Ingredient</th>
                  <th className="text-right p-3">Total Grams</th>
                  <th className="text-right p-3">Total Kg</th>
                  <th className="text-right p-3">Cost/Gram</th>
                  <th className="text-right p-3">Total Cost</th>
                  <th className="text-left p-3">Recommended Vendor</th>
                </tr>
              </thead>
              <tbody>
                {ingredientRequirements.map((ing, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{ing.ingredientName}</td>
                    <td className="p-3 text-right">{ing.totalGrams.toFixed(0)}</td>
                    <td className="p-3 text-right font-semibold">{ing.totalKg.toFixed(2)}</td>
                    <td className="p-3 text-right">₹{ing.pricePerGram.toFixed(2)}</td>
                    <td className="p-3 text-right font-semibold text-primary">
                      ₹{ing.totalCost.toFixed(2)}
                    </td>
                    <td className="p-3">{ing.vendorName}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-primary-50 font-bold">
                  <td colSpan="4" className="p-3 text-right">
                    Total Procurement Cost:
                  </td>
                  <td className="p-3 text-right text-primary-700">
                    ₹
                    {ingredientRequirements
                      .reduce((sum, ing) => sum + ing.totalCost, 0)
                      .toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Annual Projection Preview */}
      {salesTargets.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">Annual Overview</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3">Month</th>
                  <th className="text-right p-3">Target Units</th>
                  <th className="text-right p-3">Revenue</th>
                  <th className="text-right p-3">Profit</th>
                </tr>
              </thead>
              <tbody>
                {salesTargets
                  .filter((t) => t.year === selectedYear)
                  .sort((a, b) => a.month - b.month)
                  .map((target) => {
                    const totalUnits = target.targets.reduce(
                      (sum, t) => sum + t.targetUnits,
                      0
                    );
                    const totalRevenue = target.targets.reduce(
                      (sum, t) => sum + t.projectedRevenue,
                      0
                    );
                    const totalProfit = target.targets.reduce(
                      (sum, t) => sum + t.projectedProfit,
                      0
                    );

                    return (
                      <tr key={target.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{months[target.month]}</td>
                        <td className="p-3 text-right">{totalUnits}</td>
                        <td className="p-3 text-right">
                          ₹{totalRevenue.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-green-600">
                          ₹{totalProfit.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
