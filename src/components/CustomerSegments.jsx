import React, { useMemo, useState } from 'react';
import { Copy, Check, MessageCircle, Users, IndianRupee, TrendingUp, MapPin } from 'lucide-react';
import DateRangePicker from './common/DateRangePicker';
import CustomerDetailModal from './CustomerDetailModal';
import { formatDateShort } from '../utils/dateFormat';

const DAY_MS = 24 * 60 * 60 * 1000;
const FULFILLED_STATUSES = ['delivered', 'completed', 'in_transit', 'dispatched'];
const DEFAULT_CYCLE_DAYS = 30; // fallback when the SKU has no Reorder Cycle set

// A "box" lasts reorderCycleDays; a Monthly order is 4 boxes, so its cycle is x4.
// Same rule as CRM.jsx's per-SKU due list — kept identical so a customer's
// segment status agrees with what the reorder-due tab already says about them.
const effectiveCycleDays = (sku, packType) => {
  const base = parseFloat(sku?.reorderCycleDays) || 0;
  if (!base) return DEFAULT_CYCLE_DAYS;
  const isRecipe = (sku.skuType || 'weekly') === 'weekly';
  return isRecipe && packType === 'monthly' ? base * 4 : base;
};

const SEGMENTS = {
  new: { label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200', activeColor: 'bg-blue-600 border-blue-600' },
  ripe: { label: 'Ripe for 2nd order', color: 'bg-purple-50 text-purple-700 border-purple-200', activeColor: 'bg-purple-600 border-purple-600' },
  repeat: { label: 'Repeat', color: 'bg-teal-50 text-teal-700 border-teal-200', activeColor: 'bg-teal-600 border-teal-600' },
  loyal: { label: 'Loyal', color: 'bg-green-50 text-green-700 border-green-200', activeColor: 'bg-green-600 border-green-600' },
  at_risk: { label: 'At Risk', color: 'bg-rose-50 text-rose-700 border-rose-200', activeColor: 'bg-rose-600 border-rose-600' },
};

const SEGMENT_MESSAGES = {
  new: (name) => `Hi ${name}! 👋 Thanks so much for your first order with WKLY Nuts — hope you're loving it! Let us know if you have any feedback.\n\nWKLY Nuts Team 🥜`,
  ripe: (name) => `Hi ${name}! 👋 Hope you enjoyed your order with us! It's been a little while — would love to have you order again. Reply here anytime, same as before or with any changes.\n\nWKLY Nuts Team 🥜`,
  repeat: (name) => `Hi ${name}! 👋 Thanks for being a repeat customer — means a lot! Ready for your next order whenever you are.\n\nWKLY Nuts Team 🥜`,
  loyal: (name) => `Hi ${name}! 👋 You've been with us for a while now and we really appreciate it! Here's a little thank-you — let us know if there's anything we can do better.\n\nWKLY Nuts Team 🥜`,
  at_risk: (name) => `Hi ${name}! 👋 We miss you! It's been a while since your last order — everything okay? Would love to have you back, and happy to help with anything.\n\nWKLY Nuts Team 🥜`,
};

// Customer segmentation — RFM (Recency/Frequency/Monetary), adapted to this
// business's actual data shape. Deliberately rule-based, not a model: every
// segment here is fully explainable from the three numbers that produced it
// (order count, days since last order, ₹ spent), not a black-box score.
// See docs/CRM_FRAMEWORK.md for the full reasoning behind the thresholds.
export default function CustomerSegments({ orders, skus, nudges, showToast }) {
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [skuFilter, setSkuFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('ltv'); // 'ltv' | 'orderCount' | 'lastOrder'
  const [copiedId, setCopiedId] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const { profiles, cities, sources, skuNames } = useMemo(() => {
    const fulfilled = (orders || []).filter(o =>
      FULFILLED_STATUSES.includes(o.status) && Array.isArray(o.items) && o.items.length > 0
    );

    const byCustomer = new Map();
    fulfilled.forEach(o => {
      const key = o.customer_id || o.customer_name;
      if (!key) return;
      const date = new Date(o.actual_delivery_date || o.dispatch_date || o.order_date);
      if (!byCustomer.has(key)) byCustomer.set(key, []);
      byCustomer.get(key).push({ order: o, date });
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const profiles = [];
    const citySet = new Set(), sourceSet = new Set(), skuSet = new Set();

    byCustomer.forEach((entries) => {
      entries.sort((a, b) => a.date - b.date);
      const latest = entries[entries.length - 1];
      const latestOrder = latest.order;
      const latestItem = (latestOrder.items || [])[0] || {};
      const skuId = latestItem.sku_id || latestItem.skuId;
      const sku = (skus || []).find(s => s.id === skuId);
      const packType = latestItem.pack_type || latestItem.packType || 'weekly';

      const orderCount = entries.length;
      const ltv = entries.reduce((s, e) => s + (parseFloat(e.order.total_amount) || 0), 0);
      const daysSinceLast = Math.floor((today - latest.date) / DAY_MS);
      const cycleDays = effectiveCycleDays(sku, packType);
      const overdueThreshold = cycleDays * 1.5;

      let segment;
      if (orderCount === 1) {
        segment = daysSinceLast < 20 ? 'new' : 'ripe';
      } else if (daysSinceLast > overdueThreshold) {
        segment = 'at_risk';
      } else {
        segment = orderCount >= 4 ? 'loyal' : 'repeat';
      }

      const city = latestOrder.shipping_city || 'Unknown';
      const source = latestOrder.order_source || 'other';
      citySet.add(city);
      sourceSet.add(source);
      (latestOrder.items || []).forEach(it => { const n = it.sku_name || it.skuName; if (n) skuSet.add(n); });

      profiles.push({
        key: latestOrder.customer_id || latestOrder.customer_name,
        name: latestOrder.customer_name || 'Customer',
        phone: latestOrder.phone || '',
        city,
        source,
        paymentMethod: latestOrder.payment_method || 'unknown',
        orderCount,
        ltv,
        firstOrderDate: entries[0].date,
        lastOrderDate: latest.date,
        daysSinceLast,
        segment,
        primarySku: sku?.name || latestItem.sku_name || latestItem.skuName || '—',
        skuNames: [...new Set(entries.flatMap(e => (e.order.items || []).map(it => it.sku_name || it.skuName).filter(Boolean)))],
      });
    });

    // High-value one-timers: flag one-time buyers whose LTV is well above the
    // average one-time-buyer LTV — a big single order deserves a different
    // (higher-touch) message than a typical ₹300 one-timer, even though both
    // are technically "New" or "Ripe" by order count alone.
    const oneTimers = profiles.filter(p => p.orderCount === 1);
    const avgOneTimeLtv = oneTimers.length > 0 ? oneTimers.reduce((s, p) => s + p.ltv, 0) / oneTimers.length : 0;
    profiles.forEach(p => { p.highValue = p.orderCount === 1 && avgOneTimeLtv > 0 && p.ltv >= avgOneTimeLtv * 2; });

    return {
      profiles,
      cities: [...citySet].sort(),
      sources: [...sourceSet].sort(),
      skuNames: [...skuSet].sort(),
    };
  }, [orders, skus]);

  const winBackStats = useMemo(() => {
    if (!nudges || nudges.length === 0) return null;
    const byCustomerOrders = new Map();
    (orders || []).forEach(o => {
      const key = o.customer_id || o.customer_name;
      if (!key) return;
      if (!byCustomerOrders.has(key)) byCustomerOrders.set(key, []);
      byCustomerOrders.get(key).push(new Date(o.order_date));
    });
    let converted = 0;
    nudges.forEach(n => {
      const sentAt = new Date(n.sent_at);
      const relatedOrder = (orders || []).find(o => o.id === n.order_id);
      const key = relatedOrder?.customer_id || relatedOrder?.customer_name;
      if (!key) return;
      const laterOrder = (byCustomerOrders.get(key) || []).some(d => d > sentAt && (d - sentAt) / DAY_MS <= 21);
      if (laterOrder) converted++;
    });
    return { total: nudges.length, converted, rate: nudges.length > 0 ? (converted / nudges.length * 100) : 0 };
  }, [nudges, orders]);

  const filtered = useMemo(() => {
    return profiles.filter(p => {
      if (segmentFilter !== 'all' && p.segment !== segmentFilter) return false;
      if (skuFilter !== 'all' && !p.skuNames.includes(skuFilter)) return false;
      if (cityFilter !== 'all' && p.city !== cityFilter) return false;
      if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
      if (paymentFilter !== 'all' && p.paymentMethod !== paymentFilter) return false;
      if (dateFrom && p.lastOrderDate < new Date(dateFrom)) return false;
      if (dateTo && p.lastOrderDate > new Date(dateTo + 'T23:59:59')) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.phone.includes(search)) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === 'orderCount') return b.orderCount - a.orderCount;
      if (sortBy === 'lastOrder') return b.lastOrderDate - a.lastOrderDate;
      return b.ltv - a.ltv;
    });
  }, [profiles, segmentFilter, skuFilter, cityFilter, sourceFilter, paymentFilter, dateFrom, dateTo, search, sortBy]);

  const segmentCounts = useMemo(() => {
    const counts = { new: 0, ripe: 0, repeat: 0, loyal: 0, at_risk: 0 };
    profiles.forEach(p => { counts[p.segment] = (counts[p.segment] || 0) + 1; });
    return counts;
  }, [profiles]);

  const copyMsg = (p) => {
    navigator.clipboard.writeText(SEGMENT_MESSAGES[p.segment](p.name));
    setCopiedId(p.key);
    setTimeout(() => setCopiedId(null), 1500);
  };
  const openWa = (p) => {
    const phone = (p.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return;
    const formatted = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(SEGMENT_MESSAGES[p.segment](p.name))}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Win-back conversion stat */}
      {winBackStats && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-700"><strong>{winBackStats.rate.toFixed(0)}% win-back rate</strong> — {winBackStats.converted} of {winBackStats.total} nudged customers reordered within 21 days</p>
          </div>
        </div>
      )}

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setSegmentFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${segmentFilter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          All ({profiles.length})
        </button>
        {Object.entries(SEGMENTS).map(([id, cfg]) => (
          <button key={id} onClick={() => setSegmentFilter(id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${segmentFilter === id ? `${cfg.activeColor} text-white` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {cfg.label} ({segmentCounts[id] || 0})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search name/phone..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[160px]" />
        <select value={skuFilter} onChange={e => setSkuFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">All SKUs</option>
          {skuNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">All Channels</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">All Payment Methods</option>
          <option value="upi">UPI</option>
          <option value="cod">COD</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
        <DateRangePicker from={dateFrom} to={dateTo} onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="ltv">Sort: LTV (high to low)</option>
          <option value="orderCount">Sort: Order count</option>
          <option value="lastOrder">Sort: Most recent order</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} customer{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No customers match these filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Customer</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Segment</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Product</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-700"><MapPin className="w-3.5 h-3.5 inline" /> City</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Orders</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-700"><IndianRupee className="w-3.5 h-3.5 inline" /> LTV</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Last Order</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.key} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <button onClick={() => setSelectedProfile(p)} className="text-left group">
                        <div className="font-medium text-gray-900 group-hover:text-teal-600 group-hover:underline">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.phone}</div>
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${SEGMENTS[p.segment].color}`}>{SEGMENTS[p.segment].label}</span>
                      {p.highValue && <span className="ml-1 text-xs" title="High-value one-time buyer">💎</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{p.primarySku}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.city}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 font-medium">{p.orderCount}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900 font-medium">₹{p.ltv.toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{formatDateShort(p.lastOrderDate)} <span className="text-xs text-gray-400">({p.daysSinceLast}d ago)</span></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => copyMsg(p)} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded" title="Copy message">
                          {copiedId === p.key ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button onClick={() => openWa(p)} disabled={!p.phone} className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-30" title="WhatsApp">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedProfile && (
        <CustomerDetailModal profile={selectedProfile} orders={orders} onClose={() => setSelectedProfile(null)} />
      )}
    </div>
  );
}
