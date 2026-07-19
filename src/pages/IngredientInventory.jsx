import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Package, AlertCircle, Search, X, Edit2, Check, RefreshCw, Warehouse, Boxes } from 'lucide-react';
import { dbService } from '../services/supabase';
import { useApp } from '../context/AppContext';

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const { showToast } = useApp();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [editingExpiry, setEditingExpiry] = useState(null); // { batchId, ingredientId, value }
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [editingWaste, setEditingWaste] = useState(null); // { batchId, ingredientId, value }
  const [savingWaste, setSavingWaste] = useState(false);

  const [batchForm, setBatchForm] = useState({
    ingredientId: '', vendorName: '', batchNumber: '',
    quantity: '', price: '', expiryDate: '',
    receivedDate: new Date().toISOString().split('T')[0],
  });
  const [addingBatch, setAddingBatch] = useState(false);
  const [activeTab, setActiveTab] = useState('raw'); // 'raw' | 'finished'
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loadingFinished, setLoadingFinished] = useState(true);

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

  useEffect(() => { loadIngredients(); loadFinished(); }, [loadIngredients, loadFinished]);

  // Finished-goods rows flattened to one line per pack type in stock
  const finishedRows = finishedGoods.flatMap(item => {
    const rows = [];
    const name = item.sku?.name || 'Unknown SKU';
    if (item.weeklyPacksAvailable > 0) rows.push({ id: item.id + '-w', name, packType: 'Weekly pack', qty: item.weeklyPacksAvailable });
    if (item.monthlyPacksAvailable > 0) rows.push({ id: item.id + '-m', name, packType: 'Monthly pack', qty: item.monthlyPacksAvailable });
    if (item.singleUnitsAvailable > 0) rows.push({ id: item.id + '-s', name, packType: 'Unit', qty: item.singleUnitsAvailable });
    if (rows.length === 0) rows.push({ id: item.id + '-z', name, packType: '—', qty: 0 });
    return rows;
  }).filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalFinishedUnits = finishedRows.reduce((s, r) => s + r.qty, 0);

  const filtered = ingredients.filter(ing =>
    ing.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      value: parseFloat(batch.waste_quantity || 0) > 0 ? String(batch.waste_quantity) : '',
    });
  };

  const saveWaste = async () => {
    if (!editingWaste) return;
    setSavingWaste(true);
    const { data, error } = await dbService.recordBatchWaste(editingWaste.batchId, editingWaste.value || 0);
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

  // ── Add new batch ──
  const handleAddBatch = async () => {
    if (!batchForm.ingredientId || !batchForm.quantity) {
      showToast('Please select ingredient and enter quantity', 'error');
      return;
    }
    setAddingBatch(true);
    const { error } = await dbService.addIngredientBatch({
      ingredientId: batchForm.ingredientId,
      vendorId: null,
      batchNumber: batchForm.batchNumber || undefined,
      quantity: parseFloat(batchForm.quantity),
      price: parseFloat(batchForm.price) || 0,
      expiryDate: batchForm.expiryDate || null,
      receivedDate: batchForm.receivedDate,
    });
    if (error) {
      showToast('Failed to add batch: ' + error.message, 'error');
    } else {
      showToast('Batch added to inventory', 'success');
      setShowAddBatchModal(false);
      setBatchForm({ ingredientId: '', vendorName: '', batchNumber: '', quantity: '', price: '', expiryDate: '', receivedDate: new Date().toISOString().split('T')[0] });
      loadIngredients();
    }
    setAddingBatch(false);
  };

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
          {activeTab === 'raw' && (
            <button onClick={() => setShowAddBatchModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Receive Stock (New Batch)
            </button>
          )}
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
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <p className="text-2xl font-bold text-teal-600">{finishedGoods.filter(f => f.weeklyPacksAvailable > 0 || f.monthlyPacksAvailable > 0 || f.singleUnitsAvailable > 0).length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Finished units</p>
          <p className="text-2xl font-bold text-teal-600">{totalFinishedUnits}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input type="text" placeholder={activeTab === 'raw' ? 'Search ingredients...' : 'Search finished goods...'}
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
      </div>

      {/* Finished Goods tab */}
      {activeTab === 'finished' && (
        loadingFinished ? (
          <div className="text-center py-16 text-gray-400">Loading finished goods...</div>
        ) : finishedRows.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No finished goods in stock yet</p>
            <p className="text-gray-400 text-sm mt-1">Stock appears here when you mark a production run as Produced.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium">SKU</th>
                  <th className="text-left px-4 py-3 font-medium">Pack type</th>
                  <th className="text-right px-4 py-3 font-medium">In stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {finishedRows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.packType}</td>
                    <td className="px-4 py-3 text-right font-bold text-teal-700">{r.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Raw Materials tab */}
      {activeTab === 'raw' && (loading ? (
        <div className="text-center py-16 text-gray-400">Loading ingredients...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No ingredients found</p>
          <p className="text-gray-400 text-sm mt-1">Ingredients appear automatically when a Purchase Order is synced to inventory</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ing => {
            const activeBatches = (ing.ingredient_batches || []).filter(b => b.status === 'active');
            const isLow = parseFloat(ing.current_stock_total || 0) <= parseFloat(ing.safety_stock_level || 0);
            const isExpanded = expandedId === ing.id;

            return (
              <div key={ing.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : ing.id)}>
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{ing.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {activeBatches.length} active batch{activeBatches.length !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  <div className="text-right mr-3">
                    <p className="text-lg font-bold text-gray-900">{parseFloat(ing.current_stock_total || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{ing.unit || 'kg'}</p>
                  </div>
                  {isLow && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                      <AlertCircle className="w-3 h-3" /> Low
                    </span>
                  )}
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>

                {/* Expanded batch table */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 px-4 py-4">
                    <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Batches (FIFO — oldest expiry used first)</p>

                    {(ing.ingredient_batches || []).length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No batch records found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[820px]">
                          <thead>
                            <tr className="text-xs text-gray-500 border-b border-gray-200">
                              <th className="text-left pb-3 font-medium w-44">Batch #</th>
                              <th className="text-right pb-3 font-medium w-28">Qty Remaining</th>
                              <th className="text-right pb-3 font-medium w-24 pl-4">Rate/kg</th>
                              <th className="text-left pb-3 font-medium w-52 pl-4">Waste (sort)</th>
                              <th className="text-left pb-3 font-medium w-24 pl-4">Received</th>
                              <th className="text-left pb-3 font-medium w-36 pl-4">Expiry Date</th>
                              <th className="text-left pb-3 font-medium w-24">Status</th>
                              <th className="text-left pb-3 font-medium">Priority</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {(ing.ingredient_batches || [])
                              .sort((a, b) => {
                                const aDate = a.expiry_date || a.received_date;
                                const bDate = b.expiry_date || b.received_date;
                                if (!aDate && !bDate) return 0;
                                if (!aDate) return 1;
                                if (!bDate) return -1;
                                return new Date(aDate) - new Date(bDate);
                              })
                              .map((batch, idx) => {
                                const batchStatus = getBatchStatus(batch);
                                const isEditingThis = editingExpiry?.batchId === batch.id;
                                const isEditingWasteThis = editingWaste?.batchId === batch.id;
                                const hasExpiry = !!batch.expiry_date;
                                const rate = parseFloat(batch.price_per_unit || 0);
                                const initialQty = parseFloat(batch.quantity_initial || 0);
                                const wasteQty = parseFloat(batch.waste_quantity || 0);
                                const usableQty = Math.max(0, initialQty - wasteQty);
                                const effectiveRate = (wasteQty > 0 && usableQty > 0 && rate > 0)
                                  ? (initialQty * rate) / usableQty
                                  : rate;

                                return (
                                  <tr key={batch.id} className={batch.status !== 'active' ? 'opacity-50' : ''}>
                                    {/* Batch # */}
                                    <td className="py-3 font-mono text-xs text-gray-600 pr-4">{batch.batch_number || '—'}</td>

                                    {/* Qty Remaining */}
                                    <td className="py-3 text-right font-semibold text-gray-900 pr-4">
                                      {parseFloat(batch.quantity_remaining || 0).toFixed(2)}
                                      <span className="text-xs font-normal text-gray-400 ml-1">{ing.unit}</span>
                                    </td>

                                    {/* Rate / kg */}
                                    <td className="py-3 text-right pl-4 pr-4">
                                      {rate > 0 ? (
                                        <>
                                          <span className="text-gray-700">₹{rate.toLocaleString('en-IN')}</span>
                                          {wasteQty > 0 && (
                                            <span className="block text-[11px] text-amber-600 font-medium">
                                              ₹{Math.round(effectiveRate).toLocaleString('en-IN')} usable
                                            </span>
                                          )}
                                        </>
                                      ) : <span className="text-gray-300">—</span>}
                                    </td>

                                    {/* Waste (sort) */}
                                    <td className="py-3 pl-4">
                                      {isEditingWasteThis ? (
                                        <div className="flex items-center gap-1.5">
                                          <input type="number" min="0" step="0.01" value={editingWaste.value}
                                            onChange={e => setEditingWaste(prev => ({ ...prev, value: e.target.value }))}
                                            placeholder="kg" autoFocus
                                            className="border rounded px-2 py-1 text-xs focus:ring-2 focus:ring-amber-500 w-20" />
                                          <button onClick={saveWaste} disabled={savingWaste}
                                            className="p-1 text-green-600 hover:bg-green-50 rounded-lg" title="Save">
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setEditingWaste(null)}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg" title="Cancel">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          {wasteQty > 0 ? (
                                            <span className="text-xs text-gray-700">
                                              {wasteQty.toFixed(2)} {ing.unit}
                                              <span className="text-gray-400"> → {usableQty.toFixed(2)} usable</span>
                                            </span>
                                          ) : (
                                            <span className="text-gray-300 text-xs">No waste</span>
                                          )}
                                          {batch.status === 'active' && (
                                            <button onClick={() => startEditWaste(batch, ing.id)}
                                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition ${
                                                wasteQty > 0
                                                  ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                                  : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                              }`}
                                              title="Enter sorting waste">
                                              <Edit2 className="w-3 h-3" />
                                              {wasteQty === 0 && <span>Sort</span>}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* Received Date */}
                                    <td className="py-3 text-gray-600 text-xs pl-4 pr-4">
                                      {formatDate(batch.received_date)}
                                    </td>

                                    {/* Expiry Date — always shows edit button when no date set */}
                                    <td className="py-3 pl-4">
                                      {isEditingThis ? (
                                        <div className="flex items-center gap-1.5">
                                          <input type="date" value={editingExpiry.value}
                                            onChange={e => setEditingExpiry(prev => ({ ...prev, value: e.target.value }))}
                                            className="border rounded px-2 py-1 text-xs focus:ring-2 focus:ring-teal-500 w-32" />
                                          <button onClick={saveExpiry} disabled={savingExpiry}
                                            className="p-1 text-green-600 hover:bg-green-50 rounded-lg" title="Save">
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => setEditingExpiry(null)}
                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg" title="Cancel">
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          {hasExpiry ? (
                                            <span className="text-gray-700 text-xs">{formatDate(batch.expiry_date)}</span>
                                          ) : (
                                            <span className="text-orange-400 text-xs font-medium">Not set</span>
                                          )}
                                          {batch.status === 'active' && (
                                            <button onClick={() => startEditExpiry(batch, ing.id)}
                                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition ${
                                                hasExpiry
                                                  ? 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                                                  : 'text-orange-500 bg-orange-50 hover:bg-orange-100'
                                              }`}
                                              title="Set expiry date">
                                              <Edit2 className="w-3 h-3" />
                                              {!hasExpiry && <span>Add date</span>}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* Status */}
                                    <td className="py-3">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${batchStatus.color}`}>
                                        {batchStatus.label}
                                      </span>
                                    </td>

                                    {/* Priority */}
                                    <td className="py-3 text-xs text-gray-400">
                                      {batch.status === 'active' ? (idx === 0 ? '🔴 Next to use' : `#${idx + 1} Queued`) : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Add Batch Modal */}
      {showAddBatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Receive New Stock</h3>
              <button onClick={() => setShowAddBatchModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient *</label>
                <select value={batchForm.ingredientId} onChange={e => setBatchForm({ ...batchForm, ingredientId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500">
                  <option value="">Select Ingredient</option>
                  {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (kg) *</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00"
                    value={batchForm.quantity} onChange={e => setBatchForm({ ...batchForm, quantity: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate / kg (₹)</label>
                  <input type="number" min="0" step="0.01" placeholder="0"
                    value={batchForm.price} onChange={e => setBatchForm({ ...batchForm, price: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Received Date</label>
                  <input type="date" value={batchForm.receivedDate} onChange={e => setBatchForm({ ...batchForm, receivedDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" value={batchForm.expiryDate} onChange={e => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch # (Optional)</label>
                <input type="text" placeholder="e.g. B-001"
                  value={batchForm.batchNumber} onChange={e => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddBatchModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleAddBatch} disabled={addingBatch}
                  className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {addingBatch ? 'Saving...' : 'Save Batch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
