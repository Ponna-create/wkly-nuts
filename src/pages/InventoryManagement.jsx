import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function InventoryManagement() {
  const { state, dispatch, showToast } = useApp();
  const { inventory, skus } = state;
  const [showForm, setShowForm] = useState(false);
  const [editingInventory, setEditingInventory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    skuId: '',
    weeklyPacksAvailable: '',
    monthlyPacksAvailable: '',
    notes: '',
  });

  // Get SKUs that don't have inventory yet
  const skusWithoutInventory = useMemo(() => {
    const inventorySkuIds = new Set(inventory.map(inv => inv.skuId));
    return skus.filter(sku => !inventorySkuIds.has(sku.id));
  }, [skus, inventory]);

  const resetForm = () => {
    setFormData({
      skuId: '',
      weeklyPacksAvailable: '',
      monthlyPacksAvailable: '',
      notes: '',
    });
    setEditingInventory(null);
    setShowForm(false);
  };

  const handleSaveInventory = () => {
    if (!formData.skuId) {
      showToast('Please select a SKU', 'error');
      return;
    }

    const inventoryData = {
      skuId: formData.skuId,
      weeklyPacksAvailable: parseFloat(formData.weeklyPacksAvailable) || 0,
      monthlyPacksAvailable: parseFloat(formData.monthlyPacksAvailable) || 0,
      notes: formData.notes || '',
    };

    if (editingInventory) {
      dispatch({
        type: 'UPDATE_INVENTORY',
        payload: { ...inventoryData, id: editingInventory.id },
      });
      showToast('Stock updated successfully', 'success');
    } else {
      dispatch({
        type: 'ADD_INVENTORY',
        payload: { ...inventoryData, id: Date.now() + Math.random() },
      });
      showToast('Stock added successfully', 'success');
    }

    resetForm();
  };

  const handleEdit = (inv) => {
    setFormData({
      skuId: inv.skuId,
      weeklyPacksAvailable: inv.weeklyPacksAvailable.toString(),
      monthlyPacksAvailable: inv.monthlyPacksAvailable.toString(),
      notes: inv.notes || '',
    });
    setEditingInventory(inv);
    setShowForm(true);
  };

  const handleDelete = (inventoryId) => {
    if (window.confirm('Are you sure you want to delete this inventory record? This action cannot be undone.')) {
      dispatch({ type: 'DELETE_INVENTORY', payload: inventoryId });
      showToast('Inventory record deleted', 'success');
    }
  };

  // Get stock status
  const getStockStatus = (weekly, monthly) => {
    const total = weekly + monthly;
    if (total === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
    if (total < 5) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle };
    if (total < 10) return { label: 'Medium Stock', color: 'bg-blue-100 text-blue-800', icon: CheckCircle };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800', icon: CheckCircle };
  };

  // Filter inventory by search term
  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(inv => 
      inv.sku?.name?.toLowerCase().includes(term) ||
      inv.sku?.description?.toLowerCase().includes(term)
    );
  }, [inventory, searchTerm]);

  // Create inventory map for quick lookup
  const inventoryMap = useMemo(() => {
    const map = new Map();
    inventory.forEach(inv => {
      map.set(inv.skuId, inv);
    });
    return map;
  }, [inventory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track stock levels for your SKUs</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Stock
        </button>
      </div>

      {/* Search Bar */}
      {!showForm && inventory.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by SKU name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      )}

      {/* Stock Form */}
      {showForm && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editingInventory ? 'Edit Stock' : 'Add Stock'}
            </h2>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">
                SKU <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.skuId}
                onChange={(e) => setFormData({ ...formData, skuId: e.target.value })}
                className="input-field"
                disabled={!!editingInventory}
              >
                <option value="">Select SKU</option>
                {(editingInventory 
                  ? skus.filter(s => s.id === editingInventory.skuId)
                  : skusWithoutInventory
                ).map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.name}
                  </option>
                ))}
              </select>
              {editingInventory && (
                <p className="text-xs text-gray-500 mt-1">SKU cannot be changed after creation</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Weekly Packs Available
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.weeklyPacksAvailable}
                  onChange={(e) => setFormData({ ...formData, weeklyPacksAvailable: e.target.value })}
                  className="input-field"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="label">
                  Monthly Packs Available
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.monthlyPacksAvailable}
                  onChange={(e) => setFormData({ ...formData, monthlyPacksAvailable: e.target.value })}
                  className="input-field"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="label">Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                rows="3"
                placeholder="Any additional notes about this stock..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveInventory} className="btn-primary">
                {editingInventory ? 'Update Stock' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory List */}
      {!showForm && (
        <div className="card">
          {inventory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No inventory records yet</h3>
              <p className="text-gray-600 mb-4">Start tracking stock by adding your first inventory record</p>
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="w-5 h-5 inline mr-2" />
                Add Stock
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Stock Overview ({filteredInventory.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Weekly Packs</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Monthly Packs</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Packs</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Updated</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((inv) => {
                      const total = inv.weeklyPacksAvailable + inv.monthlyPacksAvailable;
                      const status = getStockStatus(inv.weeklyPacksAvailable, inv.monthlyPacksAvailable);
                      const StatusIcon = status.icon;
                      
                      return (
                        <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{inv.sku?.name || 'Unknown SKU'}</div>
                            {inv.sku?.description && (
                              <div className="text-xs text-gray-500 mt-1">{inv.sku.description}</div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="font-medium">{inv.weeklyPacksAvailable.toFixed(2)}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="font-medium">{inv.monthlyPacksAvailable.toFixed(2)}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="font-bold text-gray-900">{total.toFixed(2)}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600">
                            {inv.lastUpdated 
                              ? new Date(inv.lastUpdated).toLocaleDateString('en-IN')
                              : 'Never'
                            }
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEdit(inv)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(inv.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* SKUs without inventory */}
              {skusWithoutInventory.length > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                    SKUs without inventory records ({skusWithoutInventory.length})
                  </h3>
                  <p className="text-xs text-yellow-700 mb-2">
                    These SKUs don't have stock tracking yet. Add inventory records to track their stock levels.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {skusWithoutInventory.slice(0, 5).map((sku) => (
                      <span key={sku.id} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        {sku.name}
                      </span>
                    ))}
                    {skusWithoutInventory.length > 5 && (
                      <span className="text-xs text-yellow-700">+{skusWithoutInventory.length - 5} more</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

