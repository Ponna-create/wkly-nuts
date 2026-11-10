import React, { useEffect, useMemo, useState } from 'react';
import { Star, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { formatDate } from '../utils/dateFormat';
import { buildPricePoints, compareVendors } from '../utils/vendorPrices';

// Vendors → Compare prices: pick a raw material and see every vendor side by
// side: what we last paid, the range, how often we bought, their latest quote
// and the quality we gave their bills. Below, every price over time.

const inr = (v) => (v == null ? '—' : `₹${(Math.round(v * 100) / 100).toLocaleString('en-IN')}`);
const stars = (r) => (r == null ? '—' : `${r.toFixed(1)} ★`);
const today = () => new Date().toISOString().slice(0, 10);

export default function VendorCompare() {
  const { state, showToast } = useApp();
  const [ingredients, setIngredients] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [grade, setGrade] = useState(''); // '' = every grade of the product
  const [form, setForm] = useState(null);

  const load = async () => {
    const [i, q, o] = await Promise.all([dbService.getIngredients(), dbService.getAllPriceQuotes(), dbService.getPurchaseOrders()]);
    setIngredients(i.data || []); setQuotes(q.data || []); setOrders(o.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const vendors = state.vendors || [];
  const points = useMemo(() => buildPricePoints({ ingredients, quotes, vendors, expenses: state.expenses || [], orders }),
    [ingredients, quotes, vendors, state.expenses, orders]);

  // products with any price, most bought first
  const products = useMemo(() => {
    const m = {};
    points.forEach(p => { m[p.product] = m[p.product] || { spend: 0, n: 0 }; m[p.product].n += 1; if (p.source === 'bill') m[p.product].spend += p.qty * p.price; });
    return Object.entries(m).sort((a, b) => b[1].spend - a[1].spend || b[1].n - a[1].n).map(([k]) => k);
  }, [points]);
  useEffect(() => { if (!product && products.length) setProduct(products[0]); }, [products, product]);

  // Grades bought for this product (Dates - Black vs Dates - Dry (Yellow) cost very
  // different amounts). With one chosen, quotes are kept only when their wording
  // names that grade ("black dates"); a plain "dates" quote shows under All grades.
  const grades = useMemo(() => [...new Set(points.filter(p => p.product === product && p.source === 'bill').map(p => p.item))].sort(), [points, product]);
  const scoped = useMemo(() => {
    if (!grade) return points;
    const words = grade.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 3 && !product.toLowerCase().includes(w));
    return points.filter(p => p.product !== product || (p.source === 'bill' ? p.item === grade
      : words.some(w => p.item.toLowerCase().includes(w))));
  }, [points, product, grade]);
  const rows = useMemo(() => compareVendors(scoped, product), [scoped, product]);
  const history = useMemo(() => scoped.filter(p => p.product === product).slice().reverse(), [scoped, product]);
  const lastPaid = rows.filter(r => r.lastBill).map(r => r.lastBill.price);
  const cheapest = lastPaid.length > 1 ? Math.min(...lastPaid) : null;
  const latestQuotes = rows.filter(r => r.lastQuote).map(r => r.lastQuote.price);
  const cheapestQuote = latestQuotes.length > 1 ? Math.min(...latestQuotes) : null;

  const saveQuote = async () => {
    if (!form.vendorId) { showToast('Choose the vendor', 'error'); return; }
    if (!(parseFloat(form.price) > 0)) { showToast('Enter the price per kg', 'error'); return; }
    const { error } = await dbService.addPriceQuote({ vendorId: form.vendorId, itemName: form.item || product, price: parseFloat(form.price), date: form.date, note: form.note });
    if (error) { showToast(`Not saved: ${error.message}`, 'error'); return; }
    showToast('Price saved', 'success');
    setForm(null);
    const q = await dbService.getAllPriceQuotes();
    setQuotes(q.data || []);
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading prices…</div>;

  const shownHistory = showAll ? history : history.slice(0, 15);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-xs font-semibold text-gray-500 uppercase">Raw material
          <select value={product} onChange={e => { setProduct(e.target.value); setGrade(''); setShowAll(false); }}
            className="block mt-1 border rounded-lg px-3 py-2 text-sm font-normal normal-case text-gray-900 min-w-[220px]">
            {products.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        {grades.length > 1 && (
          <label className="text-xs font-semibold text-gray-500 uppercase">Grade
            <select value={grade} onChange={e => { setGrade(e.target.value); setShowAll(false); }}
              className="block mt-1 border rounded-lg px-3 py-2 text-sm font-normal normal-case text-gray-900 min-w-[200px]">
              <option value="">All grades</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
        <div className="flex-1" />
        <button onClick={() => setForm({ vendorId: '', item: product, price: '', date: today(), note: '' })}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add a price quote
        </button>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        <b>Paid</b> is what a bill actually cost per kg. <b>Quote</b> is a vendor's price list or a market price you noted, not a purchase.
        Rate each bill's quality in Raw Purchases (open the bill).
      </p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b bg-gray-50">
              <th className="text-left py-2 px-3 font-medium">Vendor</th>
              <th className="text-right py-2 px-3 font-medium">Last paid</th>
              <th className="text-right py-2 px-3 font-medium">Average paid</th>
              <th className="text-right py-2 px-3 font-medium">Low – high</th>
              <th className="text-right py-2 px-3 font-medium">Bought</th>
              <th className="text-right py-2 px-3 font-medium">Latest quote</th>
              <th className="text-right py-2 px-3 font-medium">Quality</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && <tr><td colSpan={7} className="py-4 px-3 text-gray-400">No prices for this item yet.</td></tr>}
            {rows.map(r => (
              <tr key={r.vendor}>
                <td className="py-2 px-3 font-medium text-gray-900">{r.vendor}</td>
                <td className="py-2 px-3 text-right">
                  {r.lastBill ? (
                    <>
                      <span className={`font-semibold ${cheapest != null && r.lastBill.price === cheapest ? 'text-green-700' : ''}`}>{inr(r.lastBill.price)}</span>
                      {cheapest != null && r.lastBill.price === cheapest && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700">lowest</span>}
                      <span className="block text-[11px] text-gray-400">{formatDate(r.lastBill.date)}{r.lastBill.grade ? ` · ${r.lastBill.grade}` : ''}</span>
                    </>
                  ) : <span className="text-gray-400">Never bought</span>}
                </td>
                <td className="py-2 px-3 text-right">{inr(r.avgPaid)}</td>
                <td className="py-2 px-3 text-right text-gray-600">{r.low != null ? `${inr(r.low)} – ${inr(r.high)}` : '—'}</td>
                <td className="py-2 px-3 text-right text-gray-600">{r.billCount ? `${r.billCount} bill${r.billCount > 1 ? 's' : ''} · ${Math.round(r.kg * 10) / 10} ${r.lastBill?.unit || 'kg'}` : '—'}</td>
                <td className="py-2 px-3 text-right">
                  {r.lastQuote ? (
                    <>
                      <span className={cheapestQuote != null && r.lastQuote.price === cheapestQuote ? 'text-green-700 font-semibold' : ''}>{inr(r.lastQuote.price)}</span>
                      <span className="block text-[11px] text-gray-400">{formatDate(r.lastQuote.date)}</span>
                    </>
                  ) : '—'}
                </td>
                <td className="py-2 px-3 text-right">
                  {r.rating != null ? <span className="text-amber-600 font-medium">{stars(r.rating)}</span> : <span className="text-gray-400">Not rated</span>}
                  {r.ratedBills > 0 && <span className="block text-[11px] text-gray-400">{r.ratedBills} bill{r.ratedBills > 1 ? 's' : ''}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{grade || product}: every price, newest first</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left py-1.5 pr-2 font-medium">Date</th>
                <th className="text-left py-1.5 px-2 font-medium">Vendor</th>
                <th className="text-left py-1.5 px-2 font-medium">Item</th>
                <th className="text-right py-1.5 px-2 font-medium">Per kg</th>
                <th className="text-left py-1.5 pl-2 font-medium">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shownHistory.map((p, i) => {
                const prev = history.slice(i + 1).find(x => x.vendor === p.vendor && x.source === p.source && x.item === p.item);
                const tone = !prev || Math.abs(prev.price - p.price) < 0.5 ? '' : p.price > prev.price ? 'text-red-600' : 'text-green-700';
                return (
                  <tr key={i}>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="py-1.5 px-2">{p.vendor}</td>
                    <td className="py-1.5 px-2 text-gray-600">{p.item}</td>
                    <td className={`py-1.5 px-2 text-right font-medium ${tone}`}>{inr(p.price)}</td>
                    <td className="py-1.5 pl-2 text-xs">
                      {p.source === 'bill'
                        ? <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">Paid · {p.ref}{p.rating ? ` · ${p.rating}★` : ''}</span>
                        : <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Quote · {p.ref}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {history.length > 15 && (
          <button onClick={() => setShowAll(!showAll)} className="mt-2 text-xs text-teal-700 underline">
            {showAll ? 'Show fewer' : `Show all ${history.length}`}
          </button>
        )}
        <p className="text-[11px] text-gray-400 mt-2">Red = higher than that vendor's previous price for the same item, green = lower.</p>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add a price quote</h2>
              <button onClick={() => setForm(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <p className="text-xs text-gray-500">A price a vendor told you or you saw in the market. It is not a purchase and does not change stock.</p>
            <label className="block text-xs text-gray-600">Vendor
              <select value={form.vendorId} onChange={e => setForm({ ...form, vendorId: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Choose…</option>
                {[...vendors].sort((a, b) => String(a.name).localeCompare(String(b.name))).map(v => <option key={v.id} value={v.id}>{String(v.name).trim()}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-600">Item (and grade)
                <input value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
              <label className="text-xs text-gray-600">Price per kg (₹)
                <input type="number" inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
              <label className="text-xs text-gray-600">Date
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
              <label className="text-xs text-gray-600">Note (optional)
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="phone call, market visit…" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setForm(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={saveQuote} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
