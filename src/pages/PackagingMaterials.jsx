import React, { useState, useEffect } from 'react';
import { Plus, Package, AlertTriangle, Search, X, Trash2, Edit2, ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';
import { dbService } from '../services/supabase';
import { useApp } from '../context/AppContext';

const CATEGORIES = {
  box_weekly: { label: 'Weekly Box', color: 'bg-blue-100 text-blue-800' },
  box_monthly: { label: 'Monthly Box', color: 'bg-indigo-100 text-indigo-800' },
  sachet: { label: 'Sachet', color: 'bg-green-100 text-green-800' },
  tape: { label: 'Tape', color: 'bg-yellow-100 text-yellow-800' },
  nitrogen: { label: 'Nitrogen', color: 'bg-purple-100 text-purple-800' },
  label: { label: 'Label', color: 'bg-pink-100 text-pink-800' },
  sticker: { label: 'Sticker', color: 'bg-orange-100 text-orange-800' },
  zipper_bag: { label: 'Zipper Bag', color: 'bg-teal-100 text-teal-800' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-800' },
};

const emptyForm = {
  name: '', category: 'other', unit: 'pcs', current_stock: 0,
  min_stock: 0, cost_per_unit: 0, vendor_name: '', notes: '',
};

const emptyTxn = {
  material_id: '', type: 'purchase', quantity: 0,
  unit_cost: 0, reference_note: '', transaction_date: new Date().toISOString().split('T')[0],
};

export default function PackagingMaterials() {
  const { showToast } = useApp();
  const [materials, setMaterials] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [showHistory, setShowHistory] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [txnForm, setTxnForm] = useState(emptyTxn);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [matRes, txnRes] = await Promise.all([
      dbService.getPackagingMaterials(),
      dbService.getPackagingTransactions(),
    ]);
    if (matRes.data) setMaterials(matRes.data);
    if (txnRes.data) setTransactions(txnRes.data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    let result;
    if (editingId) {
      result = await dbService.updatePackagingMaterial({ id: editingId, ...form });
    } else {
      result = await dbService.createPackagingMaterial(form);
    }
    if (result.error) {
      showToast('Error saving material', 'error');
    } else {
      showToast(editingId ? 'Material updated' : 'Material added', 'success');
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      loadData();
    }
  };

  const handleEdit = (mat) => {
    setForm({
      name: mat.name, category: mat.category, unit: mat.unit,
      current_stock: mat.current_stock, min_stock: mat.min_stock,
      cost_per_unit: mat.cost_per_unit, vendor_name: mat.vendor_name || '',
      notes: mat.notes || '',
    });
    setEditingId(mat.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material?')) return;
    const { error } = await dbService.deletePackagingMaterial(id);
    if (error) showToast('Error deleting', 'error');
    else { showToast('Deleted', 'success'); loadData(); }
  };

  const handleTxnSave = async () => {
    if (!txnForm.material_id || txnForm.quantity <= 0) {
      showToast('Select material and enter quantity', 'error'); return;
    }
    const totalCost = txnForm.quantity * txnForm.unit_cost;
    const result = await dbService.createPackagingTransaction({
      ...txnForm, total_cost: totalCost,
    });
    if (result.error) {
      showToast('Error saving transaction', 'error');
    } else {
      // Update stock
      const mat = materials.find(m => m.id === txnForm.material_id);
      if (mat) {
        let newStock = mat.current_stock;
        if (txnForm.type === 'purchase' || txnForm.type === 'return') {
          newStock += Number(txnForm.quantity);
        } else if (txnForm.type === 'usage') {
          newStock -= Number(txnForm.quantity);
        } else {
          newStock = Number(txnForm.quantity); // adjustment sets absolute
        }
        await dbService.updatePackagingMaterial({
          id: mat.id, current_stock: Math.max(0, newStock),
          ...(txnForm.type === 'purchase' ? {
            last_purchase_date: txnForm.transaction_date,
            last_purchase_qty: txnForm.quantity,
            last_purchase_cost: totalCost,
          } : {}),
        });
      }
      showToast('Stock updated', 'success');
      setShowTxnForm(false);
      setTxnForm(emptyTxn);
      loadData();
    }
  };

  const openStockIn = (matId) => {
    setTxnForm({ ...emptyTxn, material_id: matId, type: 'purchase', transaction_date: new Date().toISOString().split('T')[0] });
    setShowTxnForm(true);
  };

  const openStockOut = (matId) => {
    setTxnForm({ ...emptyTxn, material_id: matId, type: 'usage', transaction_date: new Date().toISOString().split('T')[0] });
    setShowTxnForm(true);
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === 'all' || m.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const lowStockCount = materials.filter(m => m.current_stock <= m.min_stock && m.min_stock > 0).length;
  const totalValue = materials.reduce((sum, m) => sum + (m.current_stock * m.cost_per_unit), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Packaging Materials</h1>
          <p className="text-gray-600 mt-1">Track boxes, sachets, labels, tape & nitrogen</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Material
          </button>
          <button onClick={() => { setTxnForm({ ...emptyTxn, transaction_date: new Date().toISOString().split('T')[0] }); setShowTxnForm(true); }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <ArrowUpCircle className="w-4 h-4" /> Stock In/Out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-2xl font-bold text-gray-900">{materials.length}</p>
          <p className="text-sm text-gray-600">Total Items</p>
        </div>
        <div className={`p-4 rounded-lg border ${lowStockCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{lowStockCount}</p>
          <p className="text-sm text-gray-600">Low Stock</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-2xl font-bold text-gray-900">{Object.keys(CATEGORIES).filter(c => materials.some(m => m.category === c)).length}</p>
          <p className="text-sm text-gray-600">Categories</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-2xl font-bold text-gray-900">{totalValue.toFixed(0)}</p>
          <p className="text-sm text-gray-600">Stock Value</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search materials..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
          <option value="all">All Categories</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Materials Grid */}
      {loading ? (
        <div className="text-center py-12"><p className="text-gray-500">Loading...</p></div>
      ) : filteredMaterials.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No materials found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((mat) => {
            const cat = CATEGORIES[mat.category] || CATEGORIES.other;
            const isLow = mat.current_stock <= mat.min_stock && mat.min_stock > 0;
            const matTxns = transactions.filter(t => t.material_id === mat.id).slice(0, 5);

            return (
              <div key={mat.id} className={`bg-white rounded-lg border ${isLow ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'} overflow-hidden`}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{mat.name}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${cat.color}`}>
                        {cat.label}
                      </span>
                    </div>
                    {isLow && <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">Stock</p>
                      <p className={`font-bold text-lg ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                        {mat.current_stock} <span className="text-xs font-normal text-gray-500">{mat.unit}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Min Stock</p>
                      <p className="font-medium text-gray-900">{mat.min_stock} {mat.unit}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Cost/Unit</p>
                      <p className="font-medium text-gray-900">{mat.cost_per_unit > 0 ? `₹${mat.cost_per_unit}` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Vendor</p>
                      <p className="font-medium text-gray-900 truncate">{mat.vendor_name || '-'}</p>
                    </div>
                  </div>

                  {mat.notes && <p className="text-xs text-gray-500 mt-2 truncate">{mat.notes}</p>}
                </div>

                {/* Actions */}
                <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between bg-gray-50">
                  <div className="flex gap-1">
                    <button onClick={() => openStockIn(mat.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Stock In">
                      <ArrowUpCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => openStockOut(mat.id)}
                      className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Stock Out">
                      <ArrowDownCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowHistory(showHistory === mat.id ? null : mat.id)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="History">
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(mat)}
                      className="p-1.5 text-gray-600 hover:bg-gray-200 rounded" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(mat.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Transaction History */}
                {showHistory === mat.id && matTxns.length > 0 && (
                  <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Recent Transactions</p>
                    {matTxns.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                        <span className={`font-medium ${t.type === 'purchase' || t.type === 'return' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'purchase' ? '+' : t.type === 'usage' ? '-' : ''}{t.quantity}
                        </span>
                        <span className="text-gray-500">{t.type}</span>
                        <span className="text-gray-400">{new Date(t.transaction_date).toLocaleDateString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Material Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Material' : 'Add Material'}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Weekly Box" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="pcs">Pieces</option>
                    <option value="rolls">Rolls</option>
                    <option value="kg">Kg</option>
                    <option value="liters">Liters</option>
                    <option value="meters">Meters</option>
                    <option value="sheets">Sheets</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Current Stock</label>
                  <input type="number" value={form.current_stock} onChange={e => setForm({...form, current_stock: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Min Stock</label>
                  <input type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Cost/Unit</label>
                  <input type="number" value={form.cost_per_unit} onChange={e => setForm({...form, cost_per_unit: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" min="0" step="0.01" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Vendor</label>
                <input type="text" value={form.vendor_name} onChange={e => setForm({...form, vendor_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Vendor name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">Cancel</button>
                <button onClick={handleSave}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">{editingId ? 'Update' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock In/Out Modal */}
      {showTxnForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Stock Transaction</h2>
              <button onClick={() => { setShowTxnForm(false); setTxnForm(emptyTxn); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Material *</label>
                <select value={txnForm.material_id} onChange={e => setTxnForm({...txnForm, material_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Select material...</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.current_stock} {m.unit})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Type</label>
                  <select value={txnForm.type} onChange={e => setTxnForm({...txnForm, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="purchase">Purchase (In)</option>
                    <option value="usage">Usage (Out)</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="return">Return (In)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Quantity *</label>
                  <input type="number" value={txnForm.quantity} onChange={e => setTxnForm({...txnForm, quantity: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Cost/Unit</label>
                  <input type="number" value={txnForm.unit_cost} onChange={e => setTxnForm({...txnForm, unit_cost: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">Date</label>
                  <input type="date" value={txnForm.transaction_date} onChange={e => setTxnForm({...txnForm, transaction_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              {txnForm.quantity > 0 && txnForm.unit_cost > 0 && (
                <p className="text-sm text-gray-600">
                  Total Cost: <span className="font-bold text-gray-900">₹{(txnForm.quantity * txnForm.unit_cost).toFixed(2)}</span>
                </p>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Note</label>
                <input type="text" value={txnForm.reference_note} onChange={e => setTxnForm({...txnForm, reference_note: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Monthly restock from vendor" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => { setShowTxnForm(false); setTxnForm(emptyTxn); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">Cancel</button>
                <button onClick={handleTxnSave}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
