import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronDown, ChevronRight, Package, AlertCircle, Search, X, Edit2, Check, RefreshCw, Warehouse, Boxes, Link2 } from 'lucide-react';
import { dbService } from '../services/supabase';
import { useApp } from '../context/AppContext';
import IngredientAliasMapping from '../components/IngredientAliasMapping';

import { formatDate as formatDateShared } from '../utils/dateFormat';
const formatDate = (date) => {
  if (!date) return '—';
  return formatDateShared(date);
};

const getBatchStatus = (batch) => {
  if (batch.status === 'consumed') return { label: 'Consumed', color: 'bg-gray-100 text-gray-500' };
  if (!batch.expiry_date) return { label: 'Active', color: 'bg-blue-100 text-blue-700' };
  const daysLeft = Math.ceil((new Date(batch.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Expired', color: 'bg-red-100 text-red-700' };
  if (daysLeft <= 30) return { label: `Expires in ${daysLeft}d`, color: 'bg-orange-100 text-orange-700' };
  return { label: 'Good', color: 'bg-green-100 text-green-700' };
};

export default function IngredientInventory() {
  const { state, showToast } = useApp();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingExpiry, setEditingExpiry] = useState(null); // { batchId, ingredientId, value }
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [editingWaste, setEditingWaste] = useState(null); // { batchId, ingredientId, value }
  const [savingWaste, setSavingWaste] = useState(false);

  const [billFilter, setBillFilter] = useState('');
  const [activeTab, setActiveTab] = useState('raw'); // 'raw' | 'finished'
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loadingFinished, setLoadingFinished] = useState(true);
  const [editingStock, setEditingStock] = useState(null); // { skuId, weekly, monthly, single }
  const [savingStock, setSavingStock] = useState(false);

  const loadIngredients = useCallback(async () => {
    setLoading(true);
    const { data } = await dbService.getIngredients();
    setIngredients(data || []);
    setLoading(false);
  }, []);

  const loadFinished = useCallback(async () => {
    setLoadingFinished(true);
    const { data } = await dbService.getInventory();
    setFinishedGoods(data || []);
    setLoadingFinished(false);
  }, []);

  const [aliases, setAliases] = useState([]);
  const loadAliases = useCallback(async () => {
    const { data } = await dbService.getIngredientAliases();
    setAliases(data || []);
  }, []);

  useEffect(() => { loadIngredients(); loadFinished(); loadAliases(); }, [loadIngredients, loadFinished, loadAliases]);

  // One row per SKU, one stock number each — a "box" (1 week) for Recipe Pack
  // SKUs, or a "unit" for everything else. Monthly is just 4 boxes at sale/
  // production time, not a separate stock pool.
  const skuStockRows = (state.skus || []).map(sku => {
    const inv = finishedGoods.find(f => f.skuId === sku.id);
    const isRecipe = (sku.skuType || 'weekly') === 'weekly';
    return {
      skuId: sku.id,
      name: sku.name,
      isRecipe,
      soldAs: sku.soldAs,
      qty: isRecipe ? (inv?.weeklyPacksAvailable || 0) : (inv?.singleUnitsAvailable || 0),
      minStockThreshold: inv?.minStockThreshold || 0,
    };
  }).filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalFinishedUnits = skuStockRows.reduce((s, r) => s + r.qty, 0);
  const skusInStockCount = skuStockRows.filter(r => r.qty > 0).length;
  const skusLowStockCount = skuStockRows.filter(r => r.minStockThreshold > 0 && r.qty < r.minStockThreshold).length;

  const startEditStock = (row) => setEditingStock({ skuId: row.skuId, isRecipe: row.isRecipe, qty: row.qty, minStockThreshold: row.minStockThreshold });

  const saveStock = async () => {
    if (!editingStock) return;
    setSavingStock(true);
    const newQty = parseFloat(editingStock.qty) || 0;
    const { error } = await dbService.setFinishedGoodsStock(editingStock.skuId, {
      weeklyPacksAvailable: editingStock.isRecipe ? newQty : 0,
      monthlyPacksAvailable: 0, // retired — monthly is now just 4 boxes, not its own pool
      singleUnitsAvailable: editingStock.isRecipe ? 0 : newQty,
      minStockThreshold: parseFloat(editingStock.minStockThreshold) || 0,
    }, 'Manual stock entry');
    setSavingStock(false);
    if (error) { showToast('Failed to update stock', 'error'); return; }
    showToast('Stock updated', 'success');
    setEditingStock(null);
    loadFinished();
  };

  // ── Edit expiry date inline ──
  const startEditExpiry = (batch, ingredientId) => {
    setEditingExpiry({
      batchId: batch.id,
      ingredientId,
      value: batch.expiry_date ? batch.expiry_date.split('T')[0] : '',
    });
  };

  const saveExpiry = async () => {
    if (!editingExpiry) return;
    setSavingExpiry(true);
    const { error } = await dbService.updateBatchExpiry(editingExpiry.batchId, editingExpiry.value || null);
    if (error) {
      showToast('Failed to update expiry date', 'error');
    } else {
      showToast('Expiry date updated', 'success');
      // Update local state
      setIngredients(prev => prev.map(ing => {
        if (ing.id !== editingExpiry.ingredientId) return ing;
        return {
          ...ing,
          ingredient_batches: (ing.ingredient_batches || []).map(b =>
            b.id === editingExpiry.batchId ? { ...b, expiry_date: editingExpiry.value || null } : b
          ),
        };
      }));
      setEditingExpiry(null);
    }
    setSavingExpiry(false);
  };

  // ── Enter sorting waste inline ──
  const startEditWaste = (batch, ingredientId) => {
    setEditingWaste({
      batchId: batch.id,
      ingredientId,
      value: '',
      previous: parseFloat(batch.waste_quantity || 0),
    });
  };

  const saveWaste = async () => {
    if (!editingWaste) return;
    setSavingWaste(true);
    const added = parseFloat(editingWaste.value) || 0;
    if (added <= 0) {
      showToast('Enter how much was wasted', 'error');
      setSavingWaste(false);
      return;
    }
    const { data, error } = await dbService.recordBatchWaste(editingWaste.batchId, (editingWaste.previous || 0) + added);
    if (error) {
      showToast('Failed to save waste', 'error');
    } else {
      showToast('Waste recorded — stock and cost updated', 'success');
      setIngredients(prev => prev.map(ing => {
        if (ing.id !== editingWaste.ingredientId) return ing;
        return {
          ...ing,
          ingredient_batches: (ing.ingredient_batches || []).map(b =>
            b.id === editingWaste.batchId
              ? { ...b, waste_quantity: data?.waste_quantity ?? (parseFloat(editingWaste.value) || 0), quantity_remaining: data?.quantity_remaining ?? b.quantity_remaining }
              : b
          ),
        };
      }));
      setEditingWaste(null);
      loadIngredients(); // refresh master stock total
    }
    setSavingWaste(false);
  };

  // Lots of one ingredient, oldest bill first (that is the order stock is used in).
  // Expiry is informational only — the bill date decides which lot goes first.
  const lotsFor = (ing) => (ing.ingredient_batches || [])
    .filter(b => b.status === 'active' && parseFloat(b.quantity_remaining || 0) > 0)
    .filter(b => !billFilter || String(b.bill_number || '') === billFilter)
    .sort((a, b) => new Date(a.received_date || 0) - new Date(b.received_date || 0));

  // How old a lot is, with the 6-month product promise in mind
  const lotAge = (batch) => {
    if (!batch.received_date) return { label: 'Age unknown', cls: 'bg-gray-100 text-gray-500' };
    const days = Math.max(0, Math.floor((Date.now() - new Date(batch.received_date).getTime()) / 86400000));
    const label = days < 45 ? `${days} days old` : `${Math.round(days / 30)} months old`;
    if (days >= 150) return { label, cls: 'bg-red-100 text-red-700' };
    if (days >= 90) return { label, cls: 'bg-amber-100 text-amber-700' };
    return { label, cls: 'bg-gray-100 text-gray-600' };
  };

  const filtered = ingredients.filter(ing =>
    ing.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!billFilter || lotsFor(ing).length > 0)
  );

  const billOptions = (() => {
    const seen = new Map();
    ingredients.forEach(ing => (ing.ingredient_batches || []).forEach(b => {
      if (b.bill_number && b.status === 'active' && !seen.has(b.bill_number)) {
        seen.set(b.bill_number, { bill: b.bill_number, date: b.received_date });
      }
    }));
    return [...seen.values()].sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 mt-1 text-sm">Raw materials you buy, and finished stock you make</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadIngredients(); loadFinished(); }} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 max-w-md">
        <button onClick={() => setActiveTab('raw')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 transition-all ${activeTab === 'raw' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Warehouse className="w-4 h-4" /> Raw Materials
        </button>
        <button onClick={() => setActiveTab('finished')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 transition-all ${activeTab === 'finished' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Boxes className="w-4 h-4" /> Finished Goods
        </button>
        <button onClick={() => setActiveTab('mapping')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 transition-all ${activeTab === 'mapping' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          title="Map generic recipe ingredient names to specific graded stock, for accurate live costing">
          <Link2 className="w-4 h-4" /> Recipe Mapping
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Raw ingredients</p>
          <p className="text-2xl font-bold">{ingredients.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Low-stock raw</p>
          <p className="text-2xl font-bold text-red-600">{ingredients.filter(i => parseFloat(i.current_stock_total || 0) <= parseFloat(i.safety_stock_level || 0)).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">SKUs in stock</p>
          <p className="text-2xl font-bold text-teal-600">{skusInStockCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Finished units</p>
          <p className="text-2xl font-bold text-teal-600">{totalFinishedUnits}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Low-stock finished</p>
          <p className="text-2xl font-bold text-red-600">{skusLowStockCount}</p>
        </div>
      </div>

      {/* Search */}
      {activeTab !== 'mapping' && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input type="text" placeholder={activeTab === 'raw' ? 'Search ingredients...' : 'Search finished goods...'}
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
        </div>
      )}

      {/* Recipe Mapping tab */}
      {activeTab === 'mapping' && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-4">
            Recipes reference ingredients by a generic name (e.g. "Almonds"), but stock is tracked by specific graded ingredient (e.g. "Almonds Premium", "Almonds Regular"). Map each generic name to whichever graded ingredient(s) it actually means — live cost blends whichever ones currently have stock.
          </p>
          <IngredientAliasMapping
            skus={state.skus || []}
            ingredients={ingredients}
            aliases={aliases}
            onSaved={loadAliases}
            showToast={showToast}
          />
        </div>
      )}

      {/* Finished Goods tab */}
      {activeTab === 'finished' && (
        loadingFinished ? (
          <div className="text-center py-16 text-gray-400">Loading finished goods...</div>
        ) : skuStockRows.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No SKUs yet</p>
            <p className="text-gray-400 text-sm mt-1">Create a SKU first, then set its opening stock here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
              Finished batches add to this count and fulfilled orders take from it automatically. Use <Edit2 className="w-3 h-3 inline" /> only to correct a counting mistake or enter opening stock.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium">SKU</th>
                  <th className="text-left px-4 py-3 font-medium">Unit</th>
                  <th className="text-right px-4 py-3 font-medium">Low stock at</th>
                  <th className="text-right px-4 py-3 font-medium">In stock</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {skuStockRows.map(r => {
                  const isEditingThis = editingStock?.skuId === r.skuId;
                  const isLow = r.minStockThreshold > 0 && r.qty < r.minStockThreshold;
                  return (
                    <tr key={r.skuId} className={isLow ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{r.isRecipe ? (r.soldAs === 'monthly' ? 'pack' : 'box (1 week)') : 'unit'}</td>
                      {isEditingThis ? (
                        <>
                          <td className="px-4 py-2 text-right">
                            <input type="number" min="0" value={editingStock.minStockThreshold || ''}
                              onChange={e => setEditingStock(prev => ({ ...prev, minStockThreshold: e.target.value }))}
                              className="w-20 border rounded px-2 py-1 text-sm text-right" placeholder="0" />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <input type="number" min="0" autoFocus value={editingStock.qty || ''}
                              onChange={e => setEditingStock(prev => ({ ...prev, qty: e.target.value }))}
                              className="w-20 border rounded px-2 py-1 text-sm text-right" />
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <button onClick={saveStock} disabled={savingStock} className="p-1 text-green-600 hover:bg-green-50 rounded-lg" title="Save">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingStock(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg" title="Cancel">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-right text-gray-500">{r.minStockThreshold > 0 ? r.minStockThreshold : '—'}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${isLow ? 'text-red-600' : 'text-teal-700'}`}>{r.qty}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => startEditStock(r)} className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg" title="Edit stock">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-4 py-2.5 text-[11px] text-gray-400 border-t">
              A Monthly order or production batch is just 4 boxes of the same product — it draws from this same box count, not a separate one.
            </p>
          </div>
        )
      )}

      {/* Raw Materials tab */}
      {activeTab === 'raw' && (loading ? (
        <div className="text-center py-16 text-gray-400">Loading ingredients...</div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <select value={billFilter} onChange={e => setBillFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white max-w-full">
              <option value="">All bills</option>
              {billOptions.map(b => (
                <option key={b.bill} value={b.bill}>Bill {b.bill} · {formatDate(b.date)}</option>
              ))}
            </select>
            <Link to="/quick-bill" className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
              <Plus className="w-4 h-4" /> Add bill
            </Link>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 font-medium">Nothing matches</p>
              <p className="text-gray-400 text-sm mt-1">Clear the search or choose All bills. New stock comes in through Add bill.</p>
            </div>
          )}

          {filtered.map(ing => {
            const lots = lotsFor(ing);
            const isLow = parseFloat(ing.current_stock_total || 0) <= parseFloat(ing.safety_stock_level || 0);
            const isExpanded = billFilter ? true : expandedId === ing.id;

            return (
              <div key={ing.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : ing.id)}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{ing.name}</p>
                    <p className="text-xs text-gray-400">{lots.length} lot{lots.length !== 1 ? 's' : ''}</p>
                  </div>
                  {isLow && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                      <AlertCircle className="w-3 h-3" /> Low
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 leading-tight">{parseFloat(ing.current_stock_total || 0).toFixed(2)}</p>
                    <p className="text-[11px] text-gray-400">{ing.unit || 'kg'}</p>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 px-4 py-1">
                    {lots.length === 0 ? (
                      <p className="text-sm text-gray-400 italic py-3">No stock in this ingredient.</p>
                    ) : lots.map((batch, idx) => {
                      const age = lotAge(batch);
                      const rate = parseFloat(batch.price_per_unit || 0);
                      const wasteQty = parseFloat(batch.waste_quantity || 0);
                      const initialQty = parseFloat(batch.quantity_initial || 0);
                      const usableQty = Math.max(0, initialQty - wasteQty);
                      const effectiveRate = (wasteQty > 0 && usableQty > 0 && rate > 0) ? (initialQty * rate) / usableQty : rate;
                      const isEditingWasteThis = editingWaste?.batchId === batch.id;
                      const isEditingExpiryThis = editingExpiry?.batchId === batch.id;
                      return (
                        <div key={batch.id} className="py-3 border-t border-gray-200 first:border-t-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {batch.bill_number ? `Bill ${batch.bill_number}` : (batch.batch_number || 'Opening stock')}
                                <span className="text-xs font-normal text-gray-400"> · {formatDate(batch.received_date)}</span>
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                {idx === 0 && lots.length > 1 && (
                                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-medium">Use first</span>
                                )}
                                <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${age.cls}`}>{age.label}</span>
                                {batch.expiry_date && (
                                  <span className="text-[11px] text-gray-500">Expiry {formatDate(batch.expiry_date)}</span>
                                )}
                                {wasteQty > 0 && (
                                  <span className="text-[11px] text-amber-700">{wasteQty.toFixed(2)} {ing.unit} waste</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {parseFloat(batch.quantity_remaining || 0).toFixed(2)}
                                <span className="text-xs font-normal text-gray-400"> {ing.unit}</span>
                              </p>
                              {rate > 0 && (
                                <p className="text-[11px] text-gray-400">
                                  ₹{Math.round(effectiveRate).toLocaleString('en-IN')}/{(ing.unit || 'kg').toLowerCase()}
                                </p>
                              )}
                            </div>
                          </div>

                          {isEditingWasteThis ? (
                            <div className="mt-2 flex items-center gap-2">
                              <input type="number" min="0" step="0.01" autoFocus value={editingWaste.value || ''}
                                onChange={e => setEditingWaste(prev => ({ ...prev, value: e.target.value }))}
                                placeholder={`${ing.unit || 'kg'} wasted`}
                                className="border rounded-lg px-2 py-1.5 text-sm w-32" />
                              <button onClick={saveWaste} disabled={savingWaste}
                                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">Save waste</button>
                              <button onClick={() => setEditingWaste(null)} className="text-sm text-gray-500">Cancel</button>
                            </div>
                          ) : isEditingExpiryThis ? (
                            <div className="mt-2 flex items-center gap-2">
                              <input type="date" value={editingExpiry.value}
                                onChange={e => setEditingExpiry(prev => ({ ...prev, value: e.target.value }))}
                                className="border rounded-lg px-2 py-1.5 text-sm" />
                              <button onClick={saveExpiry} disabled={savingExpiry}
                                className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">Save</button>
                              <button onClick={() => setEditingExpiry(null)} className="text-sm text-gray-500">Cancel</button>
                            </div>
                          ) : (
                            <div className="mt-2 flex gap-2">
                              <button onClick={() => startEditWaste(batch, ing.id)}
                                className="px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-xs font-medium">
                                Record waste
                              </button>
                              <button onClick={() => startEditExpiry(batch, ing.id)}
                                className="px-3 py-1.5 border border-gray-300 text-gray-600 bg-white rounded-lg text-xs font-medium">
                                {batch.expiry_date ? 'Change expiry' : 'Add expiry'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
