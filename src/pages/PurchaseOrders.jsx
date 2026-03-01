import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import {
  Plus, Search, X, Edit2, Trash2, Package, ChevronDown, ChevronUp,
  IndianRupee, Truck, CheckCircle, Clock, AlertCircle, FileSpreadsheet
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

  const handleStatusChange = async (po, newStatus) => {
    const updates = { ...po, status: newStatus };
    if (newStatus === 'received') updates.actual_delivery_date = new Date().toISOString().split('T')[0];
    const { data, error } = await dbService.updatePurchaseOrder(updates);
    if (error) { showToast('Failed to update status', 'error'); return; }
    setOrders(prev => prev.map(o => o.id === po.id ? (data || updates) : o));
    showToast(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
  };

  return (
    <div className="space-y-6">
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
                    {/* Items table */}
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

                    {/* Status Change + Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <span className="text-xs text-gray-500 mr-1">Change status:</span>
                      {Object.entries(STATUS_CONFIG).filter(([k]) => k !== po.status && k !== 'cancelled').map(([k, v]) => (
                        <button key={k} onClick={() => handleStatusChange(po, k)}
                          className={`px-2 py-1 text-xs rounded ${v.color} hover:opacity-80`}>{v.label}</button>
                      ))}
                      <div className="flex-1" />
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

      {/* Form Modal */}
      {showForm && (
        <POForm
          po={editingPO}
          vendors={state.vendors}
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
    </div>
  );
}

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
  const gstAmount = subtotal * 0.05; // 5% GST default
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
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input type="text" placeholder="Ingredient" value={item.ingredient_name} onChange={e => updateItem(idx, 'ingredient_name', e.target.value)}
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
          </div>

          {/* Totals */}
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
