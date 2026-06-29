import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import {
  Plus, Search, X, Edit2, Trash2, Package, ChevronDown, ChevronUp,
  IndianRupee, Truck, CheckCircle, Clock, AlertCircle, FileSpreadsheet,
  RefreshCw, TrendingUp, TrendingDown, Minus, ShoppingCart, Eye, Zap,
  BarChart3, ArrowRight, AlertTriangle
} from 'lucide-react';
import BillCSVImport from '../components/BillCSVImport';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  ordered: { label: 'Ordered', color: 'bg-blue-100 text-blue-700', icon: Package },
  confirmed: { label: 'Confirmed', color: 'bg-indigo-100 text-indigo-700', icon: CheckCircle },
  shipped: { label: 'Shipped', color: 'bg-purple-100 text-purple-700', icon: Truck },
  received: { label: 'Received', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partially_received: { label: 'Partial', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: X },
};

const TABS = [
  { id: 'orders', label: 'Purchase Orders', icon: ShoppingCart },
  { id: 'pricewatch', label: 'Price Watch', icon: Eye },
  { id: 'costimpact', label: 'Cost Impact', icon: BarChart3 },
];

export default function PurchaseOrders() {
  const { state, showToast } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [showSmartPO, setShowSmartPO] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await dbService.getPurchaseOrders();
    setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filtered = orders.filter(o => {
    const matchesSearch = !search ||
      (o.vendor_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.po_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.notes || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalValue = filtered.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
  const pendingPayment = filtered.filter(o => o.payment_status === 'pending').reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

  const handleDelete = async (id) => {
    if (!confirm('Delete this purchase order?')) return;
    const { error } = await dbService.deletePurchaseOrder(id);
    if (error) { showToast('Failed to delete PO', 'error'); return; }
    setOrders(prev => prev.filter(o => o.id !== id));
    showToast('Purchase order deleted');
  };

  const handleSyncInventory = async (po) => {
    if (po.stock_synced) {
      showToast('This PO has already been synced to inventory', 'error');
      return;
    }
    if (!confirm(`Sync ${po.po_number} (${(Array.isArray(po.items) ? po.items.length : 0)} items) to ingredient inventory?\n\nThis can only be done ONCE per PO.`)) return;
    const stockResult = await dbService.stockInFromPurchaseOrder(po);
    if (stockResult.alreadySynced) {
      showToast('This PO was already synced to inventory', 'error');
      setOrders(prev => prev.map(o => o.id === po.id ? { ...o, stock_synced: true } : o));
      return;
    }
    if (stockResult.success > 0) {
      showToast(`✅ ${stockResult.success} ingredient(s) added to inventory!`, 'success');
      setOrders(prev => prev.map(o => o.id === po.id ? { ...o, stock_synced: true } : o));
    } else {
      showToast('No items were stocked. Check item names and quantities.', 'error');
    }
    if (stockResult.errors.length > 0) {
      console.warn('Sync warnings:', stockResult.errors);
    }
  };

  const handleStatusChange = async (po, newStatus) => {
    const updates = { ...po, status: newStatus };
    if (newStatus === 'received') updates.actual_delivery_date = new Date().toISOString().split('T')[0];
    const { data, error } = await dbService.updatePurchaseOrder(updates);
    if (error) { showToast('Failed to update status', 'error'); return; }
    if (newStatus === 'received' && !po.stock_synced) {
      const stockResult = await dbService.stockInFromPurchaseOrder(po);
      if (stockResult.success > 0) {
        showToast(`${stockResult.success} ingredient(s) added to inventory`, 'success');
        setOrders(prev => prev.map(o => o.id === po.id ? { ...o, stock_synced: true } : o));
      }
      if (stockResult.errors.length > 0) {
        showToast(`Stock warnings: ${stockResult.errors[0]}`, 'error');
      }
    }
    setOrders(prev => prev.map(o => o.id === po.id ? (data || updates) : o));
    showToast(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}>
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Purchase Orders */}
      {activeTab === 'orders' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Total Value</p>
              <p className="text-2xl font-bold">{totalValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Pending Payment</p>
              <p className="text-2xl font-bold text-red-600">{pendingPayment.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Active Orders</p>
              <p className="text-2xl font-bold text-blue-600">{orders.filter(o => !['received', 'cancelled'].includes(o.status)).length}</p>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search POs..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500">
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowSmartPO(true)}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium">
                <Zap className="w-4 h-4" /> Smart PO
              </button>
              <button onClick={() => setShowCSVImport(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                title="Import POs from CSV (use ChatGPT/Gemini to convert bills)">
                <FileSpreadsheet className="w-4 h-4" /> Import Bill
              </button>
              <button onClick={() => { setEditingPO(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
                <Plus className="w-4 h-4" /> New PO
              </button>
            </div>
          </div>

          {/* PO List */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading purchase orders...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No purchase orders found</p>
              <button onClick={() => { setEditingPO(null); setShowForm(true); }} className="mt-3 text-teal-600 text-sm font-medium">+ Create your first PO</button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(po => {
                const statusConf = STATUS_CONFIG[po.status] || STATUS_CONFIG.draft;
                const items = Array.isArray(po.items) ? po.items : [];
                return (
                  <div key={po.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}>
                      <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                        <Package className="w-5 h-5 text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{po.po_number}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${statusConf.color}`}>{statusConf.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span>{po.vendor_name}</span>
                          <span>{new Date(po.order_date).toLocaleDateString('en-IN')}</span>
                          <span>{items.length} items</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">{parseFloat(po.total_amount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                        <span className={`text-xs ${po.payment_status === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                          {po.payment_status}
                        </span>
                      </div>
                      {expandedId === po.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>

                    {expandedId === po.id && (
                      <div className="border-t bg-gray-50 p-4 space-y-3">
                        {items.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-gray-500 border-b">
                                  <th className="text-left pb-2">Item</th>
                                  <th className="text-right pb-2">Qty (kg)</th>
                                  <th className="text-right pb-2">Rate</th>
                                  <th className="text-right pb-2">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, i) => (
                                  <tr key={i} className="border-b border-gray-100">
                                    <td className="py-1.5">{item.ingredient_name || item.name}</td>
                                    <td className="py-1.5 text-right">{item.quantity_kg || item.quantity}</td>
                                    <td className="py-1.5 text-right">{parseFloat(item.unit_price || item.rate || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                                    <td className="py-1.5 text-right font-medium">{parseFloat(item.total || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 text-xs">Subtotal</span>
                            <p className="font-medium">{parseFloat(po.subtotal || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">GST</span>
                            <p className="font-medium">{parseFloat(po.gst_amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Shipping</span>
                            <p className="font-medium">{parseFloat(po.shipping_charge || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Expected Delivery</span>
                            <p className="font-medium">{po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN') : '-'}</p>
                          </div>
                        </div>

                        {po.notes && <p className="text-sm text-gray-600 bg-white p-2 rounded">{po.notes}</p>}

                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <span className="text-xs text-gray-500 mr-1">Change status:</span>
                          {Object.entries(STATUS_CONFIG).filter(([k]) => k !== po.status && k !== 'cancelled').map(([k, v]) => (
                            <button key={k} onClick={() => handleStatusChange(po, k)}
                              className={`px-2 py-1 text-xs rounded ${v.color} hover:opacity-80`}>{v.label}</button>
                          ))}
                          <div className="flex-1" />
                          {po.status === 'received' && (
                            po.stock_synced ? (
                              <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed">
                                <RefreshCw className="w-3.5 h-3.5" /> Synced ✓
                              </span>
                            ) : (
                              <button onClick={() => handleSyncInventory(po)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50 rounded-lg border border-green-200">
                                <RefreshCw className="w-3.5 h-3.5" /> Sync to Inventory
                              </button>
                            )
                          )}
                          <button onClick={() => { setEditingPO(po); setShowForm(true); }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => handleDelete(po.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tab: Price Watch */}
      {activeTab === 'pricewatch' && <PriceWatchTab orders={orders} />}

      {/* Tab: Cost Impact */}
      {activeTab === 'costimpact' && <CostImpactTab orders={orders} skus={state?.skus || []} />}

      {/* Modals */}
      {showForm && (
        <POForm
          po={editingPO}
          vendors={state?.vendors || []}
          onClose={() => { setShowForm(false); setEditingPO(null); }}
          onSave={async (data) => {
            if (editingPO) {
              const { data: updated, error } = await dbService.updatePurchaseOrder({ ...data, id: editingPO.id });
              if (error) { showToast('Failed to update PO', 'error'); return; }
              setOrders(prev => prev.map(o => o.id === editingPO.id ? (updated || { ...editingPO, ...data }) : o));
              showToast('Purchase order updated');
            } else {
              const { data: created, error } = await dbService.createPurchaseOrder(data);
              if (error) { showToast('Failed to create PO', 'error'); return; }
              if (created) setOrders(prev => [created, ...prev]);
              showToast('Purchase order created');
            }
            setShowForm(false);
            setEditingPO(null);
          }}
        />
      )}

      {showCSVImport && (
        <BillCSVImport
          type="purchase_order"
          onClose={() => setShowCSVImport(false)}
          onImportComplete={() => loadOrders()}
        />
      )}

      {showSmartPO && (
        <SmartPOModal
          skus={state?.skus || []}
          vendors={state?.vendors || []}
          onClose={() => setShowSmartPO(false)}
          onCreatePO={async (poData) => {
            const { data: created, error } = await dbService.createPurchaseOrder(poData);
            if (error) { showToast('Failed to create PO', 'error'); return; }
            if (created) setOrders(prev => [created, ...prev]);
            showToast('Smart PO created!', 'success');
            setShowSmartPO(false);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  SMART PO MODAL
// ═══════════════════════════════════════════════
function SmartPOModal({ skus, vendors, onClose, onCreatePO }) {
  const [selectedSKUs, setSelectedSKUs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [shortages, setShortages] = useState(null);
  const [vendorName, setVendorName] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    (async () => {
      setLoadingInv(true);
      const { data } = await dbService.getIngredientsForProduction();
      setInventory(data || []);
      setLoadingInv(false);
    })();
  }, []);

  const addSKU = () => {
    setSelectedSKUs(prev => [...prev, { skuId: '', quantity: 1, packType: 'weekly_pack' }]);
  };

  const updateSKU = (idx, field, value) => {
    setSelectedSKUs(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeSKU = (idx) => {
    setSelectedSKUs(prev => prev.filter((_, i) => i !== idx));
  };

  const calculateShortages = () => {
    const totalNeeded = {};

    for (const sel of selectedSKUs) {
      const sku = skus.find(s => s.id === sel.skuId);
      if (!sku) continue;

      const recipes = sku.recipes || {};
      const packConfig = sel.packType === 'weekly_pack' ? (sku.weekly_pack || { days: 7 }) : (sku.monthly_pack || { days: 30 });
      const daysInPack = packConfig.days || (sel.packType === 'weekly_pack' ? 7 : 30);

      const days = Object.keys(recipes);
      if (days.length === 0) continue;

      for (let d = 0; d < daysInPack; d++) {
        const dayKey = days[d % days.length];
        const dayRecipe = recipes[dayKey] || [];
        for (const item of dayRecipe) {
          const name = (item.ingredientName || item.ingredient_name || '').toLowerCase().trim();
          if (!name) continue;
          const grams = (parseFloat(item.gramsPerSachet) || 0) * sel.quantity;
          if (!totalNeeded[name]) totalNeeded[name] = { name: item.ingredientName || item.ingredient_name, grams: 0 };
          totalNeeded[name].grams += grams;
        }
      }
    }

    const shortageList = [];
    for (const [key, needed] of Object.entries(totalNeeded)) {
      const inv = inventory.find(i => (i.name || '').toLowerCase().trim() === key);
      const stockGrams = inv ? (parseFloat(inv.current_stock_total) || 0) * 1000 : 0;
      const shortageGrams = needed.grams - stockGrams;
      shortageList.push({
        name: needed.name,
        needed_grams: needed.grams,
        stock_grams: stockGrams,
        shortage_grams: Math.max(0, shortageGrams),
        shortage_kg: Math.max(0, shortageGrams / 1000),
        editable_kg: Math.max(0, Math.ceil(shortageGrams / 100) / 10),
      });
    }

    setShortages(shortageList.filter(s => s.needed_grams > 0));
    setStep(2);
  };

  const updateShortageQty = (idx, kg) => {
    setShortages(prev => prev.map((s, i) => i === idx ? { ...s, editable_kg: parseFloat(kg) || 0 } : s));
  };

  const handleCreatePO = () => {
    const items = (shortages || [])
      .filter(s => s.editable_kg > 0)
      .map(s => ({
        ingredient_name: s.name,
        quantity_kg: s.editable_kg.toString(),
        unit_price: '',
        total: 0,
      }));

    if (items.length === 0) return;

    onCreatePO({
      vendorName: vendorName || 'TBD',
      orderDate: new Date().toISOString().split('T')[0],
      status: 'draft',
      items,
      subtotal: '0',
      gstAmount: '0',
      shippingCharge: '0',
      totalAmount: '0',
      paymentMethod: 'Bank Transfer',
      paymentStatus: 'pending',
      notes: `Smart PO: ${selectedSKUs.map(s => {
        const sku = skus.find(sk => sk.id === s.skuId);
        return `${sku?.sku_name || sku?.skuName || 'SKU'} x${s.quantity}`;
      }).join(', ')}`,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Smart PO — Production Needs
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          {step === 1 && (
            <>
              <p className="text-sm text-gray-600">Select SKUs and how many packs you plan to produce. We'll check inventory and show what's short.</p>

              {selectedSKUs.map((sel, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">{idx === 0 ? 'SKU' : ''}</label>
                    <select value={sel.skuId} onChange={e => updateSKU(idx, 'skuId', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">Select SKU...</option>
                      {skus.filter(s => s.skuCode || s.sku_code).map(s => (
                        <option key={s.id} value={s.id}>{s.sku_name || s.skuName} ({s.skuCode || s.sku_code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">{idx === 0 ? 'Pack Type' : ''}</label>
                    <select value={sel.packType} onChange={e => updateSKU(idx, 'packType', e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="weekly_pack">Weekly</option>
                      <option value="monthly_pack">Monthly</option>
                    </select>
                  </div>
                  <div className="w-20">
                    <label className="block text-xs text-gray-500 mb-1">{idx === 0 ? 'Units' : ''}</label>
                    <input type="number" min="1" value={sel.quantity} onChange={e => updateSKU(idx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button onClick={() => removeSKU(idx)} className="p-2 text-red-400 hover:text-red-600 mb-0.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button onClick={addSKU} className="text-sm text-teal-600 font-medium hover:text-teal-700">+ Add SKU</button>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={calculateShortages}
                  disabled={selectedSKUs.length === 0 || selectedSKUs.every(s => !s.skuId) || loadingInv}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                  {loadingInv ? 'Loading inventory...' : <>Check Inventory <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </>
          )}

          {step === 2 && shortages && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setStep(1)} className="text-sm text-teal-600 hover:underline">← Back</button>
                <span className="text-sm text-gray-500">Review shortages and adjust quantities</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b">
                      <th className="text-left pb-2">Ingredient</th>
                      <th className="text-right pb-2">Needed</th>
                      <th className="text-right pb-2">In Stock</th>
                      <th className="text-right pb-2">Shortage</th>
                      <th className="text-right pb-2">Order (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortages.map((s, i) => (
                      <tr key={i} className={`border-b border-gray-100 ${s.shortage_grams > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                        <td className="py-2 font-medium">{s.name}</td>
                        <td className="py-2 text-right">{(s.needed_grams / 1000).toFixed(2)} kg</td>
                        <td className="py-2 text-right">{(s.stock_grams / 1000).toFixed(2)} kg</td>
                        <td className={`py-2 text-right font-semibold ${s.shortage_grams > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {s.shortage_grams > 0 ? `${(s.shortage_grams / 1000).toFixed(2)} kg` : '✓ OK'}
                        </td>
                        <td className="py-2 text-right">
                          <input type="number" step="0.1" min="0" value={s.editable_kg}
                            onChange={e => updateShortageQty(i, e.target.value)}
                            className="w-20 border rounded px-2 py-1 text-sm text-right" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <input type="text" value={vendorName} onChange={e => setVendorName(e.target.value)} list="smartpo-vendor-list"
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Select or type vendor name" />
                <datalist id="smartpo-vendor-list">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={handleCreatePO}
                  disabled={!shortages.some(s => s.editable_kg > 0)}
                  className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  Create PO Draft
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  PRICE WATCH TAB
// ═══════════════════════════════════════════════
function PriceWatchTab({ orders }) {
  const [vendorFilter, setVendorFilter] = useState('all');

  const { trends, allVendors } = useMemo(() => {
    const ingredientMap = {};
    const vendorSet = new Set();
    const sorted = [...orders]
      .filter(o => Array.isArray(o.items) && o.items.length > 0)
      .sort((a, b) => (a.order_date || '').localeCompare(b.order_date || ''));

    sorted.forEach(po => {
      vendorSet.add(po.vendor_name);
      po.items.forEach(item => {
        const name = (item.ingredient_name || item.name || '').trim().toLowerCase();
        if (!name) return;
        const rate = parseFloat(item.unit_price || item.rate || 0);
        if (rate <= 0) return;
        if (!ingredientMap[name]) ingredientMap[name] = [];
        ingredientMap[name].push({
          rate,
          vendor: po.vendor_name,
          date: po.order_date,
          po_number: po.po_number,
        });
      });
    });

    const trends = Object.entries(ingredientMap)
      .filter(([_, entries]) => entries.length >= 1)
      .map(([name, entries]) => {
        const filteredEntries = vendorFilter === 'all' ? entries : entries.filter(e => e.vendor === vendorFilter);
        if (filteredEntries.length === 0) return null;
        const last5 = filteredEntries.slice(-5);
        const latest = filteredEntries[filteredEntries.length - 1];
        const prev = filteredEntries.length > 1 ? filteredEntries[filteredEntries.length - 2] : null;
        const change = prev ? ((latest.rate - prev.rate) / prev.rate) * 100 : 0;
        const min = Math.min(...filteredEntries.map(e => e.rate));
        const max = Math.max(...filteredEntries.map(e => e.rate));
        const avg = filteredEntries.reduce((s, e) => s + e.rate, 0) / filteredEntries.length;
        const vendors = [...new Set(filteredEntries.map(e => e.vendor))];
        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          entries: filteredEntries,
          last5,
          latestRate: latest.rate,
          latestVendor: latest.vendor,
          latestDate: latest.date,
          change,
          min, max, avg,
          entryCount: filteredEntries.length,
          vendors,
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    return { trends, allVendors: [...vendorSet].sort() };
  }, [orders, vendorFilter]);

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
        <Eye className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p>No purchase data yet. Price trends appear after your first PO with items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Filter by vendor:</span>
        <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Vendors</option>
          {allVendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="text-xs text-gray-400">{trends.length} ingredients tracked</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trends.map(t => {
          const isUp = t.change > 2;
          const isDown = t.change < -2;
          const alertColor = isUp ? 'border-red-200 bg-red-50' : isDown ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white';
          const changeColor = isUp ? 'text-red-600' : isDown ? 'text-green-600' : 'text-gray-500';
          const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

          return (
            <div key={t.name} className={`rounded-xl border p-4 ${alertColor}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{t.name}</h4>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                  isUp ? 'bg-red-100 text-red-700' : isDown ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  <TrendIcon className="w-3 h-3" />
                  {t.change > 0 ? '+' : ''}{t.change.toFixed(1)}%
                </div>
              </div>

              <div className="mb-3">
                <MiniSparkline data={t.last5.map(e => e.rate)} color={isUp ? '#dc2626' : isDown ? '#16a34a' : '#6b7280'} />
              </div>

              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className="text-2xl font-bold text-gray-900">₹{t.latestRate.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-gray-400 ml-1">/kg</span>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>Low: ₹{t.min.toLocaleString('en-IN')}</div>
                  <div>High: ₹{t.max.toLocaleString('en-IN')}</div>
                  <div>Avg: ₹{Math.round(t.avg).toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                {t.last5.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                    </span>
                    <span className="text-gray-400">{e.vendor}</span>
                    <span className="font-medium text-gray-700">₹{e.rate.toLocaleString('en-IN')}/kg</span>
                  </div>
                ))}
              </div>

              <div className="mt-2 text-xs text-gray-400">
                {t.entryCount} purchase{t.entryCount > 1 ? 's' : ''} • {t.vendors.length} vendor{t.vendors.length > 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniSparkline({ data, color = '#6b7280' }) {
  if (!data || data.length < 2) {
    return <div className="h-10 flex items-center justify-center text-xs text-gray-400">Not enough data</div>;
  }

  const width = 200;
  const height = 40;
  const padding = 4;
  const min = Math.min(...data) * 0.95;
  const max = Math.max(...data) * 1.05;
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: '40px' }}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points.join(' ')} />
      {data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill={i === data.length - 1 ? color : 'white'} stroke={color} strokeWidth="1.5" />;
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════
//  COST IMPACT TAB
// ═══════════════════════════════════════════════
function CostImpactTab({ orders, skus }) {
  const costData = useMemo(() => {
    const sorted = [...orders]
      .filter(o => Array.isArray(o.items) && o.items.length > 0 && o.order_date)
      .sort((a, b) => (a.order_date || '').localeCompare(b.order_date || ''));

    const latestPrices = {};
    const priceHistory = {};

    sorted.forEach(po => {
      po.items.forEach(item => {
        const name = (item.ingredient_name || item.name || '').trim().toLowerCase();
        if (!name) return;
        const rate = parseFloat(item.unit_price || item.rate || 0);
        if (rate <= 0) return;
        const pricePerGram = rate / 1000;
        latestPrices[name] = { pricePerGram, rate, date: po.order_date, vendor: po.vendor_name };
        if (!priceHistory[name]) priceHistory[name] = [];
        priceHistory[name].push({ pricePerGram, rate, date: po.order_date });
      });
    });

    const skuCosts = skus
      .filter(s => s.recipes && Object.keys(s.recipes).length > 0)
      .map(sku => {
        const recipes = sku.recipes || {};
        const days = Object.keys(recipes);
        if (days.length === 0) return null;

        let totalCostPerSachet = 0;
        let ingredientBreakdown = [];
        let missingPrices = [];

        const firstDayRecipe = recipes[days[0]] || [];
        for (const item of firstDayRecipe) {
          const name = (item.ingredientName || item.ingredient_name || '').trim().toLowerCase();
          const grams = parseFloat(item.gramsPerSachet) || 0;
          if (!name || grams <= 0) continue;

          const priceInfo = latestPrices[name];
          if (priceInfo) {
            const cost = grams * priceInfo.pricePerGram;
            totalCostPerSachet += cost;

            const history = priceHistory[name] || [];
            const prevPrice = history.length >= 2 ? history[history.length - 2].pricePerGram : null;
            const prevCost = prevPrice ? grams * prevPrice : null;
            const costChange = prevCost ? cost - prevCost : 0;

            ingredientBreakdown.push({
              name: item.ingredientName || item.ingredient_name,
              grams,
              costPerSachet: cost,
              prevCostPerSachet: prevCost,
              costChange,
              pricePerKg: priceInfo.rate,
            });
          } else {
            missingPrices.push(item.ingredientName || item.ingredient_name);
            const fallbackRate = parseFloat(item.pricePerGram) || 0;
            const cost = grams * fallbackRate;
            totalCostPerSachet += cost;
            ingredientBreakdown.push({
              name: item.ingredientName || item.ingredient_name,
              grams,
              costPerSachet: cost,
              prevCostPerSachet: null,
              costChange: 0,
              pricePerKg: fallbackRate * 1000,
              noPOData: true,
            });
          }
        }

        ingredientBreakdown.sort((a, b) => b.costPerSachet - a.costPerSachet);

        const sp = parseFloat(sku.sellingPrice || sku.selling_price) || 0;
        const margin = sp > 0 ? ((sp - totalCostPerSachet) / sp * 100) : 0;
        const totalChange = ingredientBreakdown.reduce((s, i) => s + i.costChange, 0);

        return {
          skuName: sku.sku_name || sku.skuName,
          skuCode: sku.skuCode || sku.sku_code,
          totalCostPerSachet,
          sellingPrice: sp,
          margin,
          totalChange,
          ingredientBreakdown,
          missingPrices,
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.totalChange) - Math.abs(a.totalChange));

    return skuCosts;
  }, [orders, skus]);

  if (costData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p>Need SKUs with recipes and at least one purchase order to show cost impact.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Per-sachet raw material cost based on latest PO prices. Shows which ingredients are driving cost changes.</p>
      <div className="space-y-4">
        {costData.map(sku => (
          <div key={sku.skuCode} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{sku.skuName}</h4>
                  <span className="text-xs text-gray-400">{sku.skuCode}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">₹{sku.totalCostPerSachet.toFixed(2)} <span className="text-xs font-normal text-gray-400">/sachet</span></div>
                  {sku.sellingPrice > 0 && (
                    <div className="text-xs">
                      SP: ₹{sku.sellingPrice} •
                      <span className={`font-bold ml-1 ${sku.margin > 30 ? 'text-green-600' : sku.margin > 15 ? 'text-amber-600' : 'text-red-600'}`}>
                        {sku.margin.toFixed(1)}% margin
                      </span>
                    </div>
                  )}
                  {sku.totalChange !== 0 && (
                    <div className={`text-xs font-semibold mt-0.5 ${sku.totalChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {sku.totalChange > 0 ? '▲' : '▼'} ₹{Math.abs(sku.totalChange).toFixed(2)}/sachet vs prev PO
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left pb-1.5">Ingredient</th>
                    <th className="text-right pb-1.5">g/sachet</th>
                    <th className="text-right pb-1.5">₹/kg</th>
                    <th className="text-right pb-1.5">Cost/sachet</th>
                    <th className="text-right pb-1.5">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {sku.ingredientBreakdown.map((ing, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5 font-medium text-gray-700">
                        {ing.name}
                        {ing.noPOData && <span className="text-[10px] text-amber-500 ml-1">(recipe rate)</span>}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">{ing.grams.toFixed(1)}g</td>
                      <td className="py-1.5 text-right text-gray-500">₹{Math.round(ing.pricePerKg).toLocaleString('en-IN')}</td>
                      <td className="py-1.5 text-right font-medium">₹{ing.costPerSachet.toFixed(2)}</td>
                      <td className={`py-1.5 text-right text-xs font-semibold ${
                        ing.costChange > 0.01 ? 'text-red-600' : ing.costChange < -0.01 ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {ing.costChange > 0.01 ? `+₹${ing.costChange.toFixed(2)}` :
                         ing.costChange < -0.01 ? `-₹${Math.abs(ing.costChange).toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sku.missingPrices.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  No PO data for: {sku.missingPrices.join(', ')} — using recipe rates
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  PO FORM
// ═══════════════════════════════════════════════
function POForm({ po, vendors, onClose, onSave }) {
  const [form, setForm] = useState({
    vendor_name: po?.vendor_name || '',
    vendor_id: po?.vendor_id || '',
    order_date: po?.order_date || new Date().toISOString().split('T')[0],
    expected_delivery_date: po?.expected_delivery_date || '',
    status: po?.status || 'ordered',
    payment_method: po?.payment_method || 'Bank Transfer',
    payment_status: po?.payment_status || 'pending',
    shipping_charge: po?.shipping_charge || '0',
    notes: po?.notes || '',
  });
  const [items, setItems] = useState(
    (Array.isArray(po?.items) && po.items.length > 0) ? po.items : [{ ingredient_name: '', quantity_kg: '', unit_price: '', total: 0 }]
  );
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const gstAmount = subtotal * 0.05;
  const totalAmount = subtotal + gstAmount + (parseFloat(form.shipping_charge) || 0);

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity_kg' || field === 'unit_price') {
        updated.total = ((parseFloat(updated.quantity_kg) || 0) * (parseFloat(updated.unit_price) || 0)).toFixed(2);
      }
      return updated;
    }));
  };

  const selectVendor = (vendorName) => {
    const vendor = vendors.find(v => v.name === vendorName);
    setForm(f => ({ ...f, vendor_name: vendorName, vendor_id: vendor?.id || '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vendor_name) return;
    setSaving(true);
    await onSave({
      vendorId: form.vendor_id || null,
      vendorName: form.vendor_name,
      orderDate: form.order_date,
      expectedDeliveryDate: form.expected_delivery_date || null,
      status: form.status,
      items: items.filter(i => i.ingredient_name),
      subtotal: subtotal.toFixed(2),
      gstAmount: gstAmount.toFixed(2),
      shippingCharge: form.shipping_charge,
      totalAmount: totalAmount.toFixed(2),
      paymentMethod: form.payment_method,
      paymentStatus: form.payment_status,
      notes: form.notes,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{po ? 'Edit Purchase Order' : 'New Purchase Order'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
              <input type="text" value={form.vendor_name} onChange={e => selectVendor(e.target.value)} list="po-vendor-list"
                className="w-full border rounded-lg px-3 py-2 text-sm" required placeholder="Select vendor" />
              <datalist id="po-vendor-list">{vendors.map(v => <option key={v.id} value={v.name} />)}</datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
              <input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
              <input type="date" value={form.expected_delivery_date} onChange={e => setForm(f => ({ ...f, expected_delivery_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Credit Card'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
              <select value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="draft">Draft</option>
                <option value="ordered">Ordered</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input type="text" placeholder="Ingredient name" value={item.ingredient_name} onChange={e => updateItem(idx, 'ingredient_name', e.target.value)}
                    list="po-ingredient-list"
                    className="col-span-4 border rounded-lg px-2 py-1.5 text-sm" />
                  <input type="number" step="0.1" placeholder="Qty (kg)" value={item.quantity_kg} onChange={e => updateItem(idx, 'quantity_kg', e.target.value)}
                    className="col-span-2 border rounded-lg px-2 py-1.5 text-sm" />
                  <input type="number" step="0.01" placeholder="Rate/kg" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                    className="col-span-2 border rounded-lg px-2 py-1.5 text-sm" />
                  <div className="col-span-3 text-sm font-medium text-right">
                    {parseFloat(item.total || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </div>
                  <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    className="col-span-1 text-red-400 hover:text-red-600 text-center">
                    <X className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setItems(prev => [...prev, { ingredient_name: '', quantity_kg: '', unit_price: '', total: 0 }])}
              className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium">+ Add Item</button>
            <datalist id="po-ingredient-list">
              {['Almond', 'Cashew', 'Walnut', 'Pistachio', 'Pumpkin Seeds', 'Sunflower Seeds', 'Flax Seeds', 'Chia Seeds',
                'Sesame Seeds', 'Melon Seeds', 'Raisins', 'Dates', 'Cranberries', 'Figs', 'Apricots',
                'Fox Nuts (Makhana)', 'Peanuts', 'Brazil Nuts', 'Macadamia', 'Hazelnuts', 'Pine Nuts'].map(name =>
                <option key={name} value={name} />
              )}
            </datalist>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{subtotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">GST (5%)</span><span>{gstAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Shipping</span>
              <input type="number" step="0.01" value={form.shipping_charge} onChange={e => setForm(f => ({ ...f, shipping_charge: e.target.value }))}
                className="w-24 border rounded px-2 py-1 text-sm text-right" />
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-1 mt-1">
              <span>Total</span>
              <span className="text-teal-700">{totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {saving ? 'Saving...' : po ? 'Update PO' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
