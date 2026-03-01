import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import {
  Plus, Search, Filter, X, Edit2, Trash2, Receipt,
  IndianRupee, Calendar, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react';

const CATEGORIES = [
  { value: 'raw_materials', label: 'Raw Materials' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'shipping', label: 'Shipping / Courier' },
  { value: 'advertising', label: 'Advertising / Ads' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'salary', label: 'Salary / Wages' },
  { value: 'courier', label: 'Courier Charges' },
  { value: 'misc', label: 'Miscellaneous' },
];

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Credit Card', 'Cheque', 'Other'];

export default function Expenses() {
  const { state, showToast } = useApp();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const { data } = await dbService.getExpenses();
    setExpenses(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const filtered = expenses.filter(e => {
    const matchesSearch = !search ||
      (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.vendor_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.payee_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.expense_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.bill_number || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'all' || e.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalAmount = filtered.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.payment_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + (parseFloat(e.total_amount) || 0), 0);

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    const { error } = await dbService.deleteExpense(id);
    if (error) { showToast('Failed to delete expense', 'error'); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
    showToast('Expense deleted');
  };

  const getCategoryLabel = (val) => CATEGORIES.find(c => c.value === val)?.label || val;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <IndianRupee className="w-4 h-4" />
            <span>This Month</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{thisMonthTotal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400">{thisMonthExpenses.length} expenses</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>All Time</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400">{filtered.length} records</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 col-span-2">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <Receipt className="w-4 h-4" />
            <span>Top Categories (This Month)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(
              thisMonthExpenses.reduce((acc, e) => {
                acc[e.category] = (acc[e.category] || 0) + (parseFloat(e.total_amount) || 0);
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, amt]) => (
              <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                <span className="font-medium">{getCategoryLabel(cat)}</span>
                <span className="text-gray-500">{amt.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setEditingExpense(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Expense List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading expenses...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No expenses found</p>
          <button onClick={() => { setEditingExpense(null); setShowForm(true); }} className="mt-3 text-amber-600 hover:text-amber-700 text-sm font-medium">
            + Add your first expense
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exp => (
            <div key={exp.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
              >
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm truncate">{exp.description || getCategoryLabel(exp.category)}</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{getCategoryLabel(exp.category)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span>{exp.expense_number}</span>
                    {exp.vendor_name && <span>{exp.vendor_name}</span>}
                    <span>{new Date(exp.payment_date).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-gray-900">{parseFloat(exp.total_amount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${exp.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {exp.payment_status}
                  </span>
                </div>
                {expandedId === exp.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>

              {expandedId === exp.id && (
                <div className="border-t bg-gray-50 p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs">Amount</span>
                      <p className="font-medium">{parseFloat(exp.amount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">GST</span>
                      <p className="font-medium">{parseFloat(exp.gst_amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Payment Method</span>
                      <p className="font-medium">{exp.payment_method || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">Bill No.</span>
                      <p className="font-medium">{exp.bill_number || '-'}</p>
                    </div>
                  </div>
                  {exp.notes && <p className="text-sm text-gray-600 bg-white p-2 rounded">{exp.notes}</p>}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setShowForm(true); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(exp.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          vendors={state.vendors}
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
          onSave={async (data) => {
            if (editingExpense) {
              const { data: updated, error } = await dbService.updateExpense({ ...data, id: editingExpense.id });
              if (error) { showToast('Failed to update expense', 'error'); return; }
              setExpenses(prev => prev.map(e => e.id === editingExpense.id ? (updated || { ...editingExpense, ...data }) : e));
              showToast('Expense updated');
            } else {
              const { data: created, error } = await dbService.createExpense(data);
              if (error) { showToast('Failed to create expense', 'error'); return; }
              if (created) setExpenses(prev => [created, ...prev]);
              showToast('Expense added');
            }
            setShowForm(false);
            setEditingExpense(null);
          }}
        />
      )}
    </div>
  );
}

function ExpenseForm({ expense, vendors, onClose, onSave }) {
  const [form, setForm] = useState({
    category: expense?.category || 'raw_materials',
    subcategory: expense?.subcategory || '',
    description: expense?.description || '',
    vendor_name: expense?.vendor_name || '',
    payee_name: expense?.payee_name || '',
    amount: expense?.amount || '',
    gst_amount: expense?.gst_amount || '0',
    total_amount: expense?.total_amount || '',
    payment_method: expense?.payment_method || 'UPI',
    payment_status: expense?.payment_status || 'paid',
    payment_date: expense?.payment_date || new Date().toISOString().split('T')[0],
    bill_number: expense?.bill_number || '',
    bill_date: expense?.bill_date || '',
    notes: expense?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const updateAmount = (amt, gst) => {
    const amount = parseFloat(amt) || 0;
    const gstAmt = parseFloat(gst) || 0;
    setForm(f => ({ ...f, amount: amt, gst_amount: gst, total_amount: (amount + gstAmt).toFixed(2) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    await onSave({
      ...form,
      vendorName: form.vendor_name,
      payeeName: form.payee_name,
      gstAmount: form.gst_amount,
      totalAmount: form.total_amount,
      paymentMethod: form.payment_method,
      paymentStatus: form.payment_status,
      paymentDate: form.payment_date,
      billNumber: form.bill_number,
      billDate: form.bill_date,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{expense ? 'Edit Expense' : 'New Expense'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="What was this expense for?" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor / Payee</label>
              <input type="text" value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" list="vendor-list" placeholder="Name" />
              <datalist id="vendor-list">
                {vendors.map(v => <option key={v.id} value={v.name} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => updateAmount(e.target.value, form.gst_amount)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0.00" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST Amount</label>
              <input type="number" step="0.01" value={form.gst_amount} onChange={e => updateAmount(form.amount, e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <div className="bg-amber-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-amber-800">Total Amount</span>
                <span className="text-lg font-bold text-amber-900">{parseFloat(form.total_amount || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
              <select value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partially Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Number</label>
              <input type="text" value={form.bill_number} onChange={e => setForm(f => ({ ...f, bill_number: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Invoice/Bill #" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label>
              <input type="date" value={form.bill_date || ''} onChange={e => setForm(f => ({ ...f, bill_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Additional notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {saving ? 'Saving...' : expense ? 'Update' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
