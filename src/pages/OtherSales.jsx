import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { formatDate } from '../utils/dateFormat';

// Sales without order: money received (mostly UPI) for sales that never got an
// order in the app. No customer details, no invoice and no invoice number, so
// the GST invoice sequence is never touched. These count in Sales and Profit
// (Reports, Profit & Cost).

const num = (v) => parseFloat(v) || 0;
const inr = (v) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ sale_date: today(), amount: '', gst_rate: 5, paid_by: '', payment_method: 'UPI', period: 'after_app', note: '' });
const PERIOD = { before_app: 'Before app', after_app: 'After app' };

export default function OtherSales() {
  const { showToast } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await dbService.getOtherSales();
    if (error) showToast('Could not load sales without order', 'error');
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => rows.filter(r => filter === 'all' || r.period === filter), [rows, filter]);
  const total = shown.reduce((t, r) => t + num(r.amount), 0);
  const totalEx = shown.reduce((t, r) => t + num(r.amount) / (1 + num(r.gst_rate) / 100), 0);

  const byMonth = useMemo(() => {
    const m = {};
    shown.forEach(r => { const k = String(r.sale_date).slice(0, 7); m[k] = m[k] || { n: 0, amt: 0 }; m[k].n += 1; m[k].amt += num(r.amount); });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [shown]);

  const save = async () => {
    if (!form.sale_date) { showToast('Choose the date', 'error'); return; }
    if (num(form.amount) <= 0) { showToast('Enter the amount received', 'error'); return; }
    setSaving(true);
    const { error } = await dbService.saveOtherSale(form);
    setSaving(false);
    if (error) { showToast(`Not saved: ${error.message}`, 'error'); return; }
    showToast(form.id ? 'Updated' : 'Saved', 'success');
    setForm(null);
    load();
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete ${inr(r.amount)} from ${r.paid_by || 'this sale'} on ${formatDate(r.sale_date)}?`)) return;
    const { error } = await dbService.deleteOtherSale(r.id);
    if (error) { showToast(`Not deleted: ${error.message}`, 'error'); return; }
    showToast('Deleted', 'success');
    load();
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales without order</h1>
          <p className="text-sm text-gray-500">Money received for sales that have no order in the app. No customer details and no invoice, so invoice numbers are not touched. Counted in Reports and Profit &amp; Cost.</p>
        </div>
        <button onClick={() => setForm(blank())} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
          <Plus className="w-4 h-4" /> Add sale
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Received (with GST)</p>
          <p className="text-xl font-bold text-gray-900">{inr(total)}</p>
          <p className="text-[11px] text-gray-400">{shown.length} sales</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Without GST</p>
          <p className="text-xl font-bold text-gray-900">{inr(totalEx)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Before app</p>
          <p className="text-xl font-bold text-gray-900">{inr(rows.filter(r => r.period === 'before_app').reduce((t, r) => t + num(r.amount), 0))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-xs text-gray-500">After app</p>
          <p className="text-xl font-bold text-gray-900">{inr(rows.filter(r => r.period === 'after_app').reduce((t, r) => t + num(r.amount), 0))}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[['all', 'All'], ['before_app', 'Before app'], ['after_app', 'After app']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${filter === k ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300'}`}>{l}</button>
        ))}
      </div>

      {byMonth.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">By month</h2>
          <div className="flex flex-wrap gap-2">
            {byMonth.map(([k, v]) => (
              <span key={k} className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                {new Date(`${k}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}: <b>{inr(v.amt)}</b> ({v.n})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? <p className="p-4 text-sm text-gray-400">Loading…</p> : shown.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Nothing here yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b bg-gray-50">
                <th className="text-left py-2 px-3 font-medium">Date</th>
                <th className="text-left py-2 px-3 font-medium">Paid by</th>
                <th className="text-right py-2 px-3 font-medium">Amount</th>
                <th className="text-left py-2 px-3 font-medium">How</th>
                <th className="text-left py-2 px-3 font-medium">Period</th>
                <th className="text-left py-2 px-3 font-medium">Note</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map(r => (
                <tr key={r.id}>
                  <td className="py-2 px-3 whitespace-nowrap">{formatDate(r.sale_date)}</td>
                  <td className="py-2 px-3">{r.paid_by || '—'}</td>
                  <td className="py-2 px-3 text-right font-semibold">{inr(r.amount)}</td>
                  <td className="py-2 px-3">{r.payment_method || '—'}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${r.period === 'before_app' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'}`}>{PERIOD[r.period]}</span>
                  </td>
                  <td className="py-2 px-3 text-xs text-gray-500 max-w-xs">{r.note}</td>
                  <td className="py-2 px-3 whitespace-nowrap text-right">
                    <button onClick={() => setForm({ ...r })} className="p-1.5 text-gray-500 hover:text-teal-700" title="Edit"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(r)} className="p-1.5 text-gray-500 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{form.id ? 'Edit sale' : 'Add sale without order'}</h2>
              <button onClick={() => setForm(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">Date
                <input type="date" value={form.sale_date} onChange={set('sale_date')} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
              <label className="text-xs text-gray-600">Amount received (with GST)
                <input type="number" inputMode="decimal" value={form.amount} onChange={set('amount')} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
              <label className="text-xs text-gray-600">Paid by (name on payment)
                <input value={form.paid_by || ''} onChange={set('paid_by')} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
              <label className="text-xs text-gray-600">How
                <select value={form.payment_method || 'UPI'} onChange={set('payment_method')} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {['UPI', 'Cash', 'Bank transfer', 'Card'].map(m => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-600">Period
                <select value={form.period} onChange={set('period')} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="before_app">Before app</option>
                  <option value="after_app">After app</option>
                </select>
              </label>
              <label className="text-xs text-gray-600">GST %
                <input type="number" value={form.gst_rate} onChange={set('gst_rate')} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
            </div>
            <label className="block text-xs text-gray-600">Note
              <input value={form.note || ''} onChange={set('note')} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
