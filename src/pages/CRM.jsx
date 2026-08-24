import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { Heart, MessageCircle, TrendingUp, Clock, Copy, Check, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { formatDateShort, formatDateTime } from '../utils/dateFormat';

const DAY_MS = 24 * 60 * 60 * 1000;
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// A "box" lasts reorderCycleDays; a Monthly order is 4 boxes, so its cycle is x4.
const effectiveCycleDays = (sku, packType) => {
  const base = parseFloat(sku?.reorderCycleDays) || 0;
  if (!base) return 0;
  const isRecipe = (sku.skuType || 'weekly') === 'weekly';
  return isRecipe && packType === 'monthly' ? base * 4 : base;
};

const DEFAULT_TIERS = [
  { maxDays: 7, discount: 0, label: 'Just due' },
  { maxDays: 20, discount: 5, label: 'A bit lapsed' },
  { maxDays: Infinity, discount: 10, label: 'Long lapsed — win back' },
];

const DEFAULT_MESSAGE = `Hi {customer_name}! 👋

Hope you've been enjoying your {product_name}! It's about time for your next pack.

{discount_line}
Reply here to place your order — same as before, or let us know if you'd like any change.

WKLY Nuts Team 🥜`;

export default function CRM() {
  const { state } = useApp();
  const skus = state.skus || [];
  const orders = state.salesOrders || [];
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [viewTab, setViewTab] = useState('due'); // 'due' | 'upgrades'
  const [upgradeFilter, setUpgradeFilter] = useState('all'); // 'all' | 'up' | 'down'
  // Keyed the same way as row.id (order+SKU+packType) so a genuinely new
  // order cycle for the same customer naturally gets a fresh, un-sent row.
  // Loaded from the DB, not localStorage, so it's the same on any device.
  const [sentMap, setSentMap] = useState({});

  useEffect(() => {
    dbService.getReorderNudges().then(({ data }) => {
      const map = {};
      (data || []).forEach(n => { map[`${n.order_id}-${n.sku_id}-${n.pack_type}`] = n.sent_at; });
      setSentMap(map);
    });
  }, []);

  const discountFor = (daysLapsed) => {
    const tier = tiers.find(t => daysLapsed <= t.maxDays) || tiers[tiers.length - 1];
    return tier;
  };

  // Build one row per (customer, SKU) using their most recent fulfilled order,
  // for SKUs that have a reorder cycle set. Also collect full history per pair
  // for the retention calculation below.
  //
  // Weekly and Monthly orders of the SAME SKU are tracked as ONE relationship,
  // not two — a customer who switches box sizes is still the same customer.
  // (Previously keyed by customer+SKU+packType, which left a stale "overdue"
  // ghost behind under the OLD pack type forever the moment someone switched —
  // e.g. their last Weekly order from 6 months ago kept showing as increasingly
  // overdue even though they'd been ordering Monthly every month since.)
  const { dueRows, upgradeRows, retentionRate, trackedPairCount } = useMemo(() => {
    const fulfilled = orders.filter(o =>
      ['delivered', 'completed', 'in_transit', 'dispatched'].includes(o.status) &&
      Array.isArray(o.items) && o.items.length > 0
    );

    const history = new Map(); // key (customer+SKU) -> [{date, order, sku, packType, item}]
    fulfilled.forEach(o => {
      const deliveryDate = o.actual_delivery_date || o.dispatch_date || o.order_date;
      if (!deliveryDate) return;
      (o.items || []).forEach(item => {
        const skuId = item.sku_id || item.skuId;
        const sku = skus.find(s => s.id === skuId);
        if (!sku || !sku.reorderCycleDays) return;
        const packType = item.pack_type || item.packType || 'weekly';
        const key = `${o.customer_id || o.customer_name}|${skuId}`;
        if (!history.has(key)) history.set(key, []);
        history.get(key).push({ date: new Date(deliveryDate), order: o, sku, packType, item });
      });
    });

    const today = todayStart();
    const dueRows = [];
    const upgradeRows = [];
    let retainedCount = 0;
    let opportunityCount = 0;

    history.forEach((entries) => {
      entries.sort((a, b) => a.date - b.date);
      const latest = entries[entries.length - 1];
      // Cadence is based on whatever they're ordering NOW, not their first-ever order.
      const cycle = effectiveCycleDays(latest.sku, latest.packType);
      if (!cycle) return;

      // Retention: for every order except the last, was there a next order
      // within 1.5x of THAT order's own cycle — checked per-gap since the
      // pack type (and so the cycle) may have changed partway through.
      for (let i = 0; i < entries.length - 1; i++) {
        opportunityCount++;
        const gapCycle = effectiveCycleDays(entries[i].sku, entries[i].packType);
        const gapDays = (entries[i + 1].date - entries[i].date) / DAY_MS;
        if (gapCycle && gapDays <= gapCycle * 1.5) retainedCount++;
      }

      // Pack-type switch: their first-ever order for this SKU differs from
      // what they're ordering now — flag it either direction (up to Monthly,
      // or back down to Weekly) so it can be reviewed/contacted separately
      // from the reorder-due list.
      const firstPackType = entries[0].packType;
      if (firstPackType !== latest.packType) {
        const switchedEntry = entries.find(e => e.packType === latest.packType) || latest;
        upgradeRows.push({
          id: `${latest.order.id}-${latest.sku.id}-switch`,
          customerName: latest.order.customer_name || 'Customer',
          phone: latest.order.phone || '',
          productName: latest.sku.name,
          fromPackType: firstPackType,
          toPackType: latest.packType,
          switchedOn: switchedEntry.date,
        });
      }

      // Due/upcoming: based on the LATEST order for this customer+SKU
      const dueDate = new Date(latest.date.getTime() + cycle * DAY_MS);
      const daysLapsed = Math.floor((today - dueDate) / DAY_MS);
      if (daysLapsed >= -3) { // due within 3 days, or already overdue
        dueRows.push({
          id: `${latest.order.id}-${latest.sku.id}-${latest.packType}`,
          orderId: latest.order.id,
          skuId: latest.sku.id,
          customerName: latest.order.customer_name || 'Customer',
          phone: latest.order.phone || '',
          productName: latest.sku.name,
          packType: latest.packType,
          lastOrderDate: latest.date,
          dueDate,
          daysLapsed,
        });
      }
    });

    dueRows.sort((a, b) => b.daysLapsed - a.daysLapsed);
    upgradeRows.sort((a, b) => b.switchedOn - a.switchedOn);
    const retentionRate = opportunityCount > 0 ? (retainedCount / opportunityCount * 100) : null;
    return { dueRows, upgradeRows, retentionRate, trackedPairCount: history.size };
  }, [orders, skus]);

  const buildMessage = (row) => {
    const tier = discountFor(row.daysLapsed);
    const discountLine = tier.discount > 0
      ? `As a thank-you, here's ${tier.discount}% off your next order! 🎁\n`
      : '';
    return messageTemplate
      .replace(/{customer_name}/g, row.customerName)
      .replace(/{product_name}/g, `${row.productName}${row.packType === 'monthly' ? ' (Monthly)' : ''}`)
      .replace(/{discount_line}/g, discountLine);
  };

  const openWhatsApp = (row) => {
    const phone = (row.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return;
    const formatted = phone.startsWith('91') ? phone : `91${phone}`;
    const msg = encodeURIComponent(buildMessage(row));
    window.open(`https://wa.me/${formatted}?text=${msg}`, '_blank');
    const sentAt = new Date().toISOString();
    setSentMap(prev => ({ ...prev, [row.id]: sentAt })); // optimistic, so the button flips instantly
    dbService.markReorderNudgeSent(row.orderId, row.skuId, row.packType).catch(() => {});
  };

  const copyMessage = (row) => {
    navigator.clipboard.writeText(buildMessage(row));
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredUpgradeRows = useMemo(() => {
    if (upgradeFilter === 'up') return upgradeRows.filter(r => r.fromPackType === 'weekly' && r.toPackType === 'monthly');
    if (upgradeFilter === 'down') return upgradeRows.filter(r => r.fromPackType === 'monthly' && r.toPackType === 'weekly');
    return upgradeRows;
  }, [upgradeRows, upgradeFilter]);

  const buildUpgradeMessage = (row) => {
    const isUpgrade = row.fromPackType === 'weekly' && row.toPackType === 'monthly';
    return isUpgrade
      ? `Hi ${row.customerName}! 👋\n\nNoticed you switched to the Monthly ${row.productName} — thank you for trusting us with more of your routine! Just checking in — how's it been going so far? Let us know if you need anything.\n\nWKLY Nuts Team 🥜`
      : `Hi ${row.customerName}! 👋\n\nJust checking in — we noticed you moved back to the Weekly ${row.productName}. Everything okay? Happy to help if anything wasn't working for you with the Monthly pack.\n\nWKLY Nuts Team 🥜`;
  };

  const copyUpgradeMessage = (row) => {
    navigator.clipboard.writeText(buildUpgradeMessage(row));
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const openUpgradeWhatsApp = (row) => {
    const phone = (row.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return;
    const formatted = phone.startsWith('91') ? phone : `91${phone}`;
    const msg = encodeURIComponent(buildUpgradeMessage(row));
    window.open(`https://wa.me/${formatted}?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Heart className="w-6 h-6 text-rose-500" /> CRM</h1>
        <p className="text-gray-500 mt-1 text-sm">Who's due to reorder, and how retention is holding up.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Due / overdue to reorder</p>
          <p className="text-2xl font-bold text-rose-600">{dueRows.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Retention rate</p>
          <p className="text-2xl font-bold text-teal-600">{retentionRate === null ? '—' : `${retentionRate.toFixed(0)}%`}</p>
          <p className="text-[11px] text-gray-400">customers who reordered within ~1.5x their cycle</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Customer-product pairs tracked</p>
          <p className="text-2xl font-bold text-gray-700">{trackedPairCount}</p>
          <p className="text-[11px] text-gray-400">only SKUs with a Reorder Cycle set are tracked</p>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 max-w-md">
        <button onClick={() => setViewTab('due')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 transition-all ${viewTab === 'due' ? 'bg-rose-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Clock className="w-4 h-4" /> Due to Reorder
        </button>
        <button onClick={() => setViewTab('upgrades')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 transition-all ${viewTab === 'upgrades' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          title="Customers who switched between Weekly and Monthly packs">
          <ArrowRightLeft className="w-4 h-4" /> Pack Switches {upgradeRows.length > 0 ? `(${upgradeRows.length})` : ''}
        </button>
      </div>

      {trackedPairCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          No SKUs have a <strong>Reorder Cycle (days)</strong> set yet — add one on each SKU (e.g. Day Pack = 7, Seed Cycle = 28) to start tracking who's due.
        </div>
      )}

      {viewTab === 'due' && (
      <>
      {/* Discount tiers */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-2">Discount suggestion rule <span className="text-xs text-gray-400 font-normal">(adjust to your policy)</span></p>
        <div className="flex flex-wrap gap-3">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-500">{t.label} · up to</span>
              <input type="number" value={t.maxDays === Infinity ? '' : t.maxDays || ''} placeholder="∞"
                onChange={e => setTiers(prev => prev.map((x, xi) => xi === i ? { ...x, maxDays: e.target.value === '' ? Infinity : parseInt(e.target.value) } : x))}
                className="w-14 border rounded px-1.5 py-1 text-center" disabled={t.maxDays === Infinity && i === tiers.length - 1} />
              <span className="text-gray-500">days late →</span>
              <input type="number" value={t.discount || ''}
                onChange={e => setTiers(prev => prev.map((x, xi) => xi === i ? { ...x, discount: parseFloat(e.target.value) || 0 } : x))}
                className="w-14 border rounded px-1.5 py-1 text-center font-semibold" />
              <span className="text-gray-500">%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Message template */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <button onClick={() => setShowTemplateEditor(s => !s)} className="w-full flex items-center justify-between p-4 text-sm font-semibold text-gray-700">
          Reorder message template
          <span className="text-teal-600 text-xs font-normal">{showTemplateEditor ? 'Hide' : 'Edit'}</span>
        </button>
        {showTemplateEditor && (
          <div className="p-4 border-t">
            <textarea value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)}
              rows={7} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
            <p className="text-[11px] text-gray-400 mt-1">Variables: {'{customer_name}'}, {'{product_name}'}, {'{discount_line}'}</p>
          </div>
        )}
      </div>

      {/* Due list */}
      {dueRows.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No one is due to reorder right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dueRows.map(row => {
            const tier = discountFor(row.daysLapsed);
            return (
              <div key={row.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{row.customerName}</span>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full">{row.productName}{row.packType === 'monthly' ? ' · Monthly' : ''}</span>
                    {row.daysLapsed > 0 ? (
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-xs rounded-full font-medium">{row.daysLapsed}d overdue</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-xs rounded-full font-medium">due in {Math.abs(row.daysLapsed)}d</span>
                    )}
                    {tier.discount > 0 && (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full font-medium">suggest {tier.discount}% off</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Last order {formatDateShort(row.lastOrderDate)} · due {formatDateShort(row.dueDate)}{row.phone ? ` · ${row.phone}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => copyMessage(row)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 border rounded-lg">
                    {copiedId === row.id ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                  <button
                    onClick={() => openWhatsApp(row)}
                    disabled={!row.phone}
                    title={sentMap[row.id] ? `Sent ${formatDateTime(sentMap[row.id])} — click to send again` : undefined}
                    className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 ${
                      sentMap[row.id]
                        ? 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {sentMap[row.id]
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Sent</>
                      : <><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {viewTab === 'upgrades' && (
        <>
          {/* Filter chips */}
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'All switches' },
              { id: 'up', label: 'Weekly → Monthly' },
              { id: 'down', label: 'Monthly → Weekly' },
            ].map(f => (
              <button key={f.id} onClick={() => setUpgradeFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${upgradeFilter === f.id ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {filteredUpgradeRows.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No pack-type switches {upgradeFilter !== 'all' ? 'matching this filter ' : ''}found yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUpgradeRows.map(row => {
                const isUpgrade = row.fromPackType === 'weekly' && row.toPackType === 'monthly';
                return (
                  <div key={row.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{row.customerName}</span>
                        <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full">{row.productName}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${isUpgrade ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {row.fromPackType === 'monthly' ? 'Monthly' : 'Weekly'} → {row.toPackType === 'monthly' ? 'Monthly' : 'Weekly'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Switched on {formatDateShort(row.switchedOn)}{row.phone ? ` · ${row.phone}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => copyUpgradeMessage(row)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 border rounded-lg">
                        {copiedId === row.id ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                      </button>
                      <button
                        onClick={() => openUpgradeWhatsApp(row)}
                        disabled={!row.phone}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 bg-green-600 text-white hover:bg-green-700"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
