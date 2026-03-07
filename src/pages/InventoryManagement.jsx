import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, X, Package, AlertTriangle, CheckCircle, Layers, Leaf, Box } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';

export default function InventoryManagement() {
  const { state, dispatch, showToast } = useApp();
  const { inventory, skus } = state;
  const [activeTab, setActiveTab] = useState('finished');
  const [showForm, setShowForm] = useState(false);
  const [editingInventory, setEditingInventory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ skuId: '', weeklyPacksAvailable: '', monthlyPacksAvailable: '', notes: '' });

  // Raw materials & packaging state
  const [ingredients, setIngredients] = useState([]);
  const [packagingMaterials, setPackagingMaterials] = useState([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  useEffect(() => {
    loadExtraData();
  }, []);

  const loadExtraData = async () => {
    setLoadingExtra(true);
    const [ingRes, pkgRes] = await Promise.all([
      dbService.getIngredients(),
      dbService.getPackagingMaterials(),
    ]);
    setIngredients(ingRes.data || []);
    setPackagingMaterials(pkgRes.data || []);
    setLoadingExtra(false);
  };

  const skusWithoutInventory = useMemo(() => {
    const inventorySkuIds = new Set(inventory.map(inv => inv.skuId));
    return skus.filter(sku => !inventorySkuIds.has(sku.id));
  }, [skus, inventory]);

  const resetForm = () => { setFormData({ skuId: '', weeklyPacksAvailable: '', monthlyPacksAvailable: '', notes: '' }); setEditingInventory(null); setShowForm(false); };

  const handleSaveInventory = () => {
    if (!formData.skuId) { showToast('Please select a SKU', 'error'); return; }
    const data = {
      skuId: formData.skuId,
      weeklyPacksAvailable: parseFloat(formData.weeklyPacksAvailable) || 0,
      monthlyPacksAvailable: parseFloat(formData.monthlyPacksAvailable) || 0,
      notes: formData.notes || '',
    };
    if (editingInventory) {
      dispatch({ type: 'UPDATE_INVENTORY', payload: { ...data, id: editingInventory.id } });
      showToast('Stock updated', 'success');
    } else {
      dispatch({ type: 'ADD_INVENTORY', payload: { ...data, id: Date.now() + Math.random() } });
      showToast('Stock added', 'success');
    }
    resetForm();
  };

  const handleEdit = (inv) => {
    setFormData({ skuId: inv.skuId, weeklyPacksAvailable: inv.weeklyPacksAvailable.toString(), monthlyPacksAvailable: inv.monthlyPacksAvailable.toString(), notes: inv.notes || '' });
    setEditingInventory(inv);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this inventory record?')) {
      dispatch({ type: 'DELETE_INVENTORY', payload: id });
      showToast('Deleted', 'success');
    }
  };

  const getStockStatus = (weekly, monthly) => {
    const total = weekly + monthly;
    if (total === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    if (total < 5) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    if (total < 10) return { label: 'Medium', color: 'bg-blue-100 text-blue-800', icon: CheckCircle };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800', icon: CheckCircle };
  };

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(inv => inv.sku?.name?.toLowerCase().includes(term));
  }, [inventory, searchTerm]);

  // Summary stats
  const totalFinishedGoods = inventory.reduce((s, i) => s + (i.weeklyPacksAvailable || 0) + (i.monthlyPacksAvailable || 0), 0);
  const lowStockIngredients = ingredients.filter(i => i.current_stock_total <= (i.safety_stock_level || 0));
  const lowStockPackaging = packagingMaterials.filter(p => (p.current_stock || 0) <= (p.min_stock || 0));

  const tabs = [
    { id: 'finished', label: 'Finished Goods', icon: Package, count: inventory.length, color: 'teal' },
    { id: 'raw', label: 'Raw Materials', icon: Leaf, count: ingredients.length, color: 'amber' },
    { id: 'packaging', label: 'Packaging', icon: Box, count: packagingMaterials.length, color: 'indigo' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Finished Goods</p>
          <p className="text-2xl font-bold text-teal-600">{totalFinishedGoods}</p>
          <p className="text-xs text-gray-400">total packs</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Raw Materials</p>
          <p className="text-2xl font-bold text-amber-600">{ingredients.length}</p>
          <p className="text-xs text-gray-400">ingredients tracked</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Packaging Items</p>
          <p className="text-2xl font-bold text-indigo-600">{packagingMaterials.length}</p>
          <p className="text-xs text-gray-400">materials tracked</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Low Stock Alerts</p>
          <p className="text-2xl font-bold text-red-600">{lowStockIngredients.length + lowStockPackaging.length}</p>
          <p className="text-xs text-gray-400">items need attention</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? `bg-${tab.color}-600 text-white`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={activeTab === tab.id ? { backgroundColor: tab.color === 'teal' ? '#0d9488' : tab.color === 'amber' ? '#d97706' : '#4f46e5' } : {}}>
              <Icon className="w-4 h-4" />
              {tab.label} ({tab.count})
            </button>
          );
        })}
      </div>

      {/* Finished Goods Tab */}
      {activeTab === 'finished' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Stock
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg border p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">{editingInventory ? 'Edit Stock' : 'Add Stock'}</h3>
                <button onClick={resetForm}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <select value={formData.skuId} onChange={e => setFormData({ ...formData, skuId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" disabled={!!editingInventory}>
                    <option value="">Select SKU</option>
                    {(editingInventory ? skus.filter(s => s.id === editingInventory.skuId) : skusWithoutInventory).map(s =>
                      <option key={s.id} value={s.id}>{s.name}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weekly Packs</label>
                  <input type="number" min="0" value={formData.weeklyPacksAvailable} onChange={e => setFormData({ ...formData, weeklyPacksAvailable: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Packs</label>
                  <input type="number" min="0" value={formData.monthlyPacksAvailable} onChange={e => setFormData({ ...formData, monthlyPacksAvailable: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional notes" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={resetForm} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleSaveInventory} className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                  {editingInventory ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}

          {filteredInventory.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No finished goods inventory</p>
              <button onClick={() => setShowForm(true)} className="mt-3 text-teal-600 text-sm font-medium">+ Add Stock</button>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Weekly</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Monthly</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Total</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map(inv => {
                    const total = (inv.weeklyPacksAvailable || 0) + (inv.monthlyPacksAvailable || 0);
                    const status = getStockStatus(inv.weeklyPacksAvailable, inv.monthlyPacksAvailable);
                    const StatusIcon = status.icon;
                    return (
                      <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{inv.sku?.name || 'Unknown'}</td>
                        <td className="py-3 px-4 text-right">{(inv.weeklyPacksAvailable || 0).toFixed(0)}</td>
                        <td className="py-3 px-4 text-right">{(inv.monthlyPacksAvailable || 0).toFixed(0)}</td>
                        <td className="py-3 px-4 text-right font-bold">{total.toFixed(0)}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            <StatusIcon className="w-3 h-3" /> {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => handleEdit(inv)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                          </div>
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

      {/* Raw Materials Tab */}
      {activeTab === 'raw' && (
        <div className="space-y-4">
          {loadingExtra ? (
            <div className="text-center py-12 text-gray-500">Loading raw materials...</div>
          ) : ingredients.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No raw materials tracked yet</p>
              <p className="text-xs text-gray-400 mt-1">Raw materials are auto-added when you receive a Purchase Order</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Ingredient</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Stock</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Unit</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Safety Level</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Active Batches</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map(ing => {
                    const stock = parseFloat(ing.current_stock_total || 0);
                    const safety = parseFloat(ing.safety_stock_level || 0);
                    const isLow = stock <= safety;
                    const activeBatches = (ing.ingredient_batches || []).filter(b => b.status === 'active');
                    return (
                      <tr key={ing.id} className={`border-b border-gray-100 ${isLow ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                        <td className="py-3 px-4 font-medium">{ing.name}</td>
                        <td className="py-3 px-4 text-right font-bold">{stock.toFixed(2)}</td>
                        <td className="py-3 px-4 text-gray-500">{ing.unit || 'kg'}</td>
                        <td className="py-3 px-4 text-right text-gray-500">{safety.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{activeBatches.length} batch{activeBatches.length !== 1 ? 'es' : ''}</span>
                        </td>
                        <td className="py-3 px-4">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3" /> Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3" /> OK
                            </span>
                          )}
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

      {/* Packaging Tab */}
      {activeTab === 'packaging' && (
        <div className="space-y-4">
          {loadingExtra ? (
            <div className="text-center py-12 text-gray-500">Loading packaging materials...</div>
          ) : packagingMaterials.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border">
              <Box className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No packaging materials tracked yet</p>
              <p className="text-xs text-gray-400 mt-1">Go to Packaging Materials page to add items</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Material</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Stock</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Unit</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Min Stock</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Cost/Unit</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {packagingMaterials.map(mat => {
                    const stock = mat.current_stock || 0;
                    const minStock = mat.min_stock || 0;
                    const isLow = stock <= minStock;
                    return (
                      <tr key={mat.id} className={`border-b border-gray-100 ${isLow ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                        <td className="py-3 px-4 font-medium">{mat.name}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize">{mat.category || 'other'}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold">{stock}</td>
                        <td className="py-3 px-4 text-gray-500">{mat.unit || 'pcs'}</td>
                        <td className="py-3 px-4 text-right text-gray-500">{minStock}</td>
                        <td className="py-3 px-4 text-right">{parseFloat(mat.cost_per_unit || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                        <td className="py-3 px-4">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3" /> Low
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3" /> OK
                            </span>
                          )}
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
}
