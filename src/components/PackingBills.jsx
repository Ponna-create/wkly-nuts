import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/dateFormat';

// Packaging → Packing bills: every packing / printing bill (Expenses with
// category 'packaging'), newest first, with supplier and month filters,
// spend by supplier and by month. Bills are added and edited in Quick → Bill
// or Expenses; this page only reads them.

const inr = (v) => `₹${Math.round(v || 0).toLocaleString('en-IN')}`;
const dayOf = (e) => String(e.bill_date || e.payment_date || e.created_at || '').slice(0, 10);

export default function PackingBills({ materials = [] }) {
  const { state } = useApp();
  const [search, setSearch] = useState('');
  const [supplier, setSupplier] = useState('all');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');

  const bills = useMemo(() => (state.expenses || [])
    .filter(e => e.category === 'packaging')
    .map(e => ({ ...e, day: dayOf(e), supplier: String(e.vendor_name || '').trim() || 'Supplier not named', amt: parseFloat(e.total_amount) || 0 }))
    .sort((a, b) => b.day.localeCompare(a.day)), [state.expenses]);

  const q = search.trim().toLowerCase();
  const shown = bills.filter(b => (supplier === 'all' || b.supplier === supplier)
    && (!fromMonth || b.day.slice(0, 7) >= fromMonth) && (!toMonth || b.day.slice(0, 7) <= toMonth)
    && (!q || `${b.supplier} ${b.description || ''} ${b.bill_number || ''} ${b.notes || ''}`.toLowerCase().includes(q)));
  const total = shown.reduce((t, b) => t + b.amt, 0);
  const thisYear = new Date().getFullYear().toString();
  const yearTotal = bills.filter(b => b.day.startsWith(thisYear)).reduce((t, b) => t + b.amt, 0);
  const suppliers = [...new Set(bills.map(b => b.supplier))].sort();
  const hasFilter = !!(q || supplier !== 'all' || fromMonth || toMonth);

  const bySupplier = Object.entries(shown.reduce((m, b) => { m[b.supplier] = m[b.supplier] || { n: 0, amt: 0, last: '' }; m[b.supplier].n += 1; m[b.supplier].amt += b.amt; if (b.day > m[b.supplier].last) m[b.supplier].last = b.day; return m; }, {}))
    .sort((a, b) => b[1].amt - a[1].amt);
  const byMonth = Object.entries(shown.reduce((m, b) => { const k = b.day.slice(0, 7); if (!k) return m; m[k] = m[k] || { n: 0, amt: 0 }; m[k].n += 1; m[k].amt += b.amt; return m; }, {}))
    .sort((a, b) => a[0].localeCompare(b[0]));
  // which packing items each supplier makes (from Packaging items' supplier)
  const itemsOf = (s) => materials.filter(m => String(m.vendor_name || '').trim().toLowerCase() === s.toLowerCase()).map(m => m.name);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Bills</p>
          <p className="text-2xl font-bold text-gray-900">{shown.length}</p>
          <p className="text-[11px] text-gray-400">{bySupplier.length} suppliers</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Spent{hasFilter ? ' (filtered)' : ''}</p>
          <p className="text-2xl font-bold text-gray-900">{inr(total)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Spent in {thisYear}</p>
          <p className="text-2xl font-bold text-teal-700">{inr(yearTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col justify-center">
          <Link to="/quick-bill" className="text-sm font-medium text-teal-700 underline">Add a packing bill</Link>
          <p className="text-[11px] text-gray-400 mt-1">In Quick → Bill, choose Packaging. Edit bills in Expenses.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier, item or bill no..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <select value={supplier} onChange={e => setSupplier(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="all">All suppliers</option>
          {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="text-xs text-gray-500">From
          <input type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} className="block border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-gray-500">To
          <input type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} className="block border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </label>
        {hasFilter && <button onClick={() => { setSearch(''); setSupplier('all'); setFromMonth(''); setToMonth(''); }} className="text-xs text-teal-700 underline py-2">Clear</button>}
      </div>

      {bySupplier.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">By supplier</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-1.5 pr-2 font-medium">Supplier</th>
                  <th className="text-left py-1.5 px-2 font-medium">Supplies</th>
                  <th className="text-right py-1.5 px-2 font-medium">Bills</th>
                  <th className="text-right py-1.5 px-2 font-medium">Last bill</th>
                  <th className="text-right py-1.5 pl-2 font-medium">Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bySupplier.map(([s, v]) => {
                  const items = itemsOf(s);
                  return (
                    <tr key={s} className="cursor-pointer hover:bg-gray-50" onClick={() => setSupplier(supplier === s ? 'all' : s)}>
                      <td className="py-1.5 pr-2 font-medium text-gray-900">{s}</td>
                      <td className="py-1.5 px-2 text-xs text-gray-500">{items.length ? (items.length > 3 ? `${items.slice(0, 3).join(', ')} +${items.length - 3}` : items.join(', ')) : '—'}</td>
                      <td className="py-1.5 px-2 text-right">{v.n}</td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">{formatDate(v.last)}</td>
                      <td className="py-1.5 pl-2 text-right font-semibold">{inr(v.amt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Tap a supplier to see only their bills.</p>
        </div>
      )}

      {byMonth.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Spent by month</p>
          <div className="flex flex-wrap gap-2">
            {byMonth.map(([m, v]) => (
              <span key={m} className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                {new Date(`${m}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}: <b>{inr(v.amt)}</b> ({v.n})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {shown.length === 0 ? <p className="p-4 text-sm text-gray-400">No packing bills match.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b bg-gray-50">
                <th className="text-left py-2 px-3 font-medium">Date</th>
                <th className="text-left py-2 px-3 font-medium">Supplier</th>
                <th className="text-left py-2 px-3 font-medium">What</th>
                <th className="text-right py-2 px-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map(b => (
                <tr key={b.id}>
                  <td className="py-2 px-3 whitespace-nowrap">{formatDate(b.day)}</td>
                  <td className="py-2 px-3">{b.supplier}</td>
                  <td className="py-2 px-3">
                    {b.description || '—'}{b.bill_number ? <span className="text-xs text-gray-400"> · Bill {b.bill_number}</span> : null}
                    {b.notes && <span className="block text-[11px] text-gray-400">{b.notes}</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold">{inr(b.amt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
