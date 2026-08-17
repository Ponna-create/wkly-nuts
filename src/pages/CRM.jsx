import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Heart, MessageCircle, TrendingUp, Clock, Copy, Check } from 'lucide-react';
import { formatDateShort } from '../utils/dateFormat';

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

  const discountFor = (daysLapsed) => {
    const tier = tiers.find(t => daysLapsed <= t.maxDays) || tiers[tiers.length - 1];
    return tier;
  };

  // Build one row per (customer, SKU) using their most recent fulfilled order,
  // for SKUs that have a reorder cycle set. Also collect full history per pair
  // for the retention calculation below.
  const { dueRows, retentionRate, trackedPairCount } = useMemo(() => {
    const fulfilled = orders.filter(o =>
      ['delivered', 'completed', 'in_transit', 'dispatched'].includes(o.status) &&
      Array.isArray(o.items) && o.items.length > 0
    );

    const history = new Map(); // key -> [{date, order}]
    fulfilled.forEach(o => {
      const deliveryDate = o.actual_delivery_date || o.dispatch_date || o.order_date;
      if (!deliveryDate) return;
      (o.items || []).forEach(item => {
        const skuId = item.sku_id || item.skuId;
        const sku = skus.find(s => s.id === skuId);
        if (!sku || !sku.reorderCycleDays) return;
        const packType = item.pack_type || item.packType || 'weekly';
        const key = `${o.customer_id || o.customer_name}|${skuId}|${packType === 'monthly' ? 'm' : 'w'}`;
        if (!history.has(key)) history.set(key, []);
        history.get(key).push({ date: new Date(deliveryDate), order: o, sku, packType, item });
      });
    });

    const today = todayStart();
    const dueRows = [];
    let retainedCount = 0;
    let opportunityCount = 0;

    history.forEach((entries) => {
      entries.sort((a, b) => a.date - b.date);
      const cycle = effectiveCycleDays(entries[0].sku, entries[0].packType);
      if (!cycle) return;

      // Retention: for every order except the last, was there a next order within 1.5x the cycle?
      for (let i = 0; i < entries.length - 1; i++) {
        opportunityCount++;
        const gapDays = (entries[i + 1].date - entries[i].date) / DAY_MS;
        if (gapDays <= cycle * 1.5) retainedCount++;
      }

      // Due/upcoming: based on the LATEST order in this pair
      const latest = entries[entries.length - 1];
      const dueDate = new Date(latest.date.getTime() + cycle * DAY_MS);
      const daysLapsed = Math.floor((today - dueDate) / DAY_MS);
      if (daysLapsed >= -3) { // due within 3 days, or already overdue
        dueRows.push({
          id: `${latest.order.id}-${latest.sku.id}-${latest.packType}`,
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
    const retentionRate = opportunityCount > 0 ? (retainedCount / opportunityCount * 100) : null;
    return { dueRows, retentionRate, trackedPairCount: history.size };
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
  };

  const copyMessage = (row) => {
    navigator.clipboard.writeText(buildMessage(row));
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 1500);
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

      {trackedPairCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          No SKUs have a <strong>Reorder Cycle (days)</strong> set yet — add one on each SKU (e.g. Day Pack = 7, Seed Cycle = 28) to start tracking who's due.
        </div>
      )}

      {/* Discount tiers */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-2">Discount suggestion rule <span className="text-xs text-gray-400 font-normal">(adjust to your policy)</span></p>
        <div className="flex flex-wrap gap-3">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-500">{t.label} · up to</span>
              <input type="number" value={t.maxDays === Infinity ? '' : t.maxDays} placeholder="∞"
                onChange={e => setTiers(prev => prev.map((x, xi) => xi === i ? { ...x, maxDays: e.target.value === '' ? Infinity : parseInt(e.target.value) } : x))}
                className="w-14 border rounded px-1.5 py-1 text-center" disabled={t.maxDays === Infinity && i === tiers.length - 1} />
              <span className="text-gray-500">days late →</span>
              <input type="number" value={t.discount}
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
                  <button onClick={() => openWhatsApp(row)} disabled={!row.phone}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
