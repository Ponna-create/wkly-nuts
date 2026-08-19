import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Package, Truck, Users, ChevronRight, PieChart, TrendingUp, TrendingDown, Cloud, CloudOff } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/dateFormat';

const SOURCE_LABELS = {
  whatsapp: 'WhatsApp', website: 'Website', instagram: 'Instagram', inst: 'Instagram',
  meta_ad: 'Meta Ads', amazon: 'Amazon', zoho: 'Zoho', direct: 'Direct',
  collab: 'Collab', promotion: 'Promotion', referral: 'Referral', other: 'Other',
};
const DELAYED_PAYMENT_CHANNELS = ['amazon', 'zoho'];
const CHANNEL_COLORS = {
  whatsapp: 'bg-green-500', direct: 'bg-teal-500', website: 'bg-blue-500', zoho: 'bg-indigo-500',
  amazon: 'bg-orange-500', instagram: 'bg-pink-500', inst: 'bg-pink-500', meta_ad: 'bg-purple-500',
  collab: 'bg-yellow-500', promotion: 'bg-cyan-500', referral: 'bg-lime-500', other: 'bg-gray-400',
};

const todayStr = () => new Date().toISOString().split('T')[0];
const currentMonthKey = () => todayStr().slice(0, 7);
const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const itemName = (it) => it.sku_name || it.skuName || 'Item';
const itemQty = (it) => parseFloat(it.quantity || it.qty || 0);
const daysInMonth = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export default function Dashboard() {
  const { state, useDatabase, connectionError, isLoading } = useApp();
  const orders = state.salesOrders || [];
  const skus = state.skus || [];
  const inventory = state.inventory || [];
  const expenses = state.expenses || [];
  const purchaseOrders = state.purchaseOrders || [];
  const isCloudSynced = !!useDatabase;
  const isCheckingConnection = !!isLoading;

  // Every calendar month from the earliest order through the current month —
  // not just months that happen to have orders. A month with zero sales is
  // still a real (likely NIL-filed) GST period and should stay selectable,
  // not silently disappear from the dropdown just because nothing sold.
  const availableMonths = useMemo(() => {
    const orderMonths = orders.map(o => o.order_date?.slice(0, 7)).filter(Boolean);
    const earliest = orderMonths.length > 0 ? orderMonths.sort()[0] : currentMonthKey();
    const months = [];
    let [y, m] = earliest.split('-').map(Number);
    const [curY, curM] = currentMonthKey().split('-').map(Number);
    while (y < curY || (y === curY && m <= curM)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return months.reverse();
  }, [orders]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const isCurrentMonth = selectedMonth === currentMonthKey();
  const lastDayToShow = isCurrentMonth ? Number(todayStr().slice(8, 10)) : daysInMonth(selectedMonth);

  const monthOrders = useMemo(() => orders.filter(o => o.order_date?.slice(0, 7) === selectedMonth), [orders, selectedMonth]);

  // ---- Sales Summary (merged, toggle) ----
  const [salesView, setSalesView] = useState('value'); // 'value' | 'orders'
  const salesSeries = useMemo(() => {
    const byDay = {};
    for (let d = 1; d <= lastDayToShow; d++) {
      const key = String(d).padStart(2, '0');
      byDay[key] = { day: key, value: 0, orders: 0 };
    }
    monthOrders.forEach(o => {
      const day = o.order_date?.slice(8, 10) || '?';
      if (!byDay[day]) byDay[day] = { day, value: 0, orders: 0 };
      byDay[day].value += parseFloat(o.total_amount) || 0;
      byDay[day].orders += 1;
    });
    return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
  }, [monthOrders, lastDayToShow]);
  const salesTotal = monthOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);

  // ---- Out of Stock ----
  const outOfStock = useMemo(() => {
    return skus.filter(sku => {
      const inv = inventory.find(i => i.sku_id === sku.id || i.skuId === sku.id);
      const units = (inv?.weekly_packs_available || inv?.weeklyPacksAvailable || 0) + (inv?.single_units_available || inv?.singleUnitsAvailable || 0);
      return units <= 0;
    });
  }, [skus, inventory]);

  // ---- Pending Actions ----
  const followUpCount = orders.filter(o => o.status === 'follow_up').length;
  const toBePacked = orders.filter(o => o.status === 'confirmed').length;
  const toBeShipped = orders.filter(o => o.status === 'packing').length;
  const toBeCollected = orders.filter(o => o.status === 'fulfilled').length;
  const toBeDelivered = orders.filter(o => ['collected', 'dispatched', 'transit'].includes(o.status)).length;
  const needTracking = orders.filter(o => o.status === 'collected' && !o.tracking_number).length;
  const toBeInvoiced = orders.filter(o => !o.invoice_id && o.status !== 'delivered').length;
  const poPending = purchaseOrders.filter(p => p.status !== 'received' && p.status !== 'completed').length;
  const belowReorder = outOfStock.length > 0 ? outOfStock.length : 0;

  const recentActivity = useMemo(() =>
    [...orders].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)).slice(0, 6),
    [orders]
  );
  const [actionsTab, setActionsTab] = useState('pending');

  // ---- Top Selling ----
  // Weekly vs Monthly tracked separately per SKU, not just a combined
  // total — a SKU selling 18 units could be all-Weekly, all-Monthly, or a
  // mix, and that split matters for production planning (Monthly is 4x the
  // ingredients of a Weekly box). Only Recipe Pack SKUs (skuType 'weekly' —
  // Day Pack, Nutrition Pack, Night Soak) actually have a real
  // Weekly/Monthly distinction. Every order item still carries a pack_type
  // of 'weekly' as an internal placeholder even for single-price SKUs
  // (Seed Cycle, Dates, Mexican Bites, etc.), so without checking the SKU's
  // real type those were wrongly showing up as "all Weekly" too.
  const recipePackNames = useMemo(() =>
    new Set(skus.filter(s => s.skuType === 'weekly').map(s => s.name)),
    [skus]
  );
  const topSelling = useMemo(() => {
    const byItem = {};
    monthOrders.forEach(o => {
      (o.items || []).forEach(it => {
        const name = itemName(it);
        const qty = itemQty(it);
        const isRecipePack = recipePackNames.has(name);
        const isMonthly = isRecipePack && (it.pack_type || it.packType || '').toLowerCase() === 'monthly';
        if (!byItem[name]) byItem[name] = { name, qty: 0, weekly: 0, monthly: 0, isRecipePack };
        byItem[name].qty += qty;
        if (isMonthly) byItem[name].monthly += qty; else if (isRecipePack) byItem[name].weekly += qty;
      });
    });
    return Object.values(byItem).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [monthOrders]);

  // ---- Cash Flow ----
  const cashFlow = useMemo(() => {
    const monthExpenses = expenses.filter(e => (e.payment_date || e.bill_date || '').slice(0, 7) === selectedMonth);
    const incoming = monthOrders.reduce((s, o) => s + (parseFloat(o.amount_paid) || (o.payment_status === 'received' ? parseFloat(o.total_amount) || 0 : 0)), 0);
    const outgoing = monthExpenses.reduce((s, e) => s + (parseFloat(e.total_amount) || 0), 0);
    const byDay = {};
    for (let d = 1; d <= lastDayToShow; d++) {
      const key = String(d).padStart(2, '0');
      byDay[key] = { day: key, net: 0 };
    }
    monthOrders.forEach(o => {
      const day = o.order_date?.slice(8, 10) || '?';
      const paid = parseFloat(o.amount_paid) || (o.payment_status === 'received' ? parseFloat(o.total_amount) || 0 : 0);
      byDay[day] = byDay[day] || { day, net: 0 };
      byDay[day].net += paid;
    });
    monthExpenses.forEach(e => {
      const day = (e.payment_date || e.bill_date || '').slice(8, 10) || '?';
      byDay[day] = byDay[day] || { day, net: 0 };
      byDay[day].net -= parseFloat(e.total_amount) || 0;
    });
    let running = 0;
    const series = Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)).map(d => {
      running += d.net;
      return { day: d.day, balance: running };
    });
    return { incoming, outgoing, series };
  }, [monthOrders, expenses, selectedMonth, lastDayToShow]);

  // ---- Receivables / Payables ----
  const receivables = useMemo(() => {
    const pending = orders.filter(o => DELAYED_PAYMENT_CHANNELS.includes(o.order_source) && o.payment_status !== 'received');
    return pending.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
  }, [orders]);
  const payables = useMemo(() => {
    const unpaidExpenses = expenses.filter(e => e.payment_status && e.payment_status !== 'paid').reduce((s, e) => s + (parseFloat(e.total_amount) || 0), 0);
    const unpaidPOs = purchaseOrders.filter(p => p.payment_status && p.payment_status !== 'paid').reduce((s, p) => s + (parseFloat(p.total_amount) || 0), 0);
    return unpaidExpenses + unpaidPOs;
  }, [expenses, purchaseOrders]);

  // ---- Channel performance ----
  const channelPerformance = useMemo(() => {
    const bySource = {};
    orders.forEach(o => {
      const src = o.order_source || 'other';
      if (!bySource[src]) bySource[src] = { orders: 0, revenue: 0 };
      bySource[src].orders += 1;
      bySource[src].revenue += parseFloat(o.total_amount) || 0;
    });
    return Object.entries(bySource).map(([source, v]) => ({ source, label: SOURCE_LABELS[source] || source, ...v })).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  // Backup reminder
  const lastBackupRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('wklyNutsLastBackup') : null;
  const backupDays = lastBackupRaw ? Math.floor((Date.now() - new Date(lastBackupRaw).getTime()) / 86400000) : null;
  const backupTone = backupDays === null ? 'red' : backupDays >= 7 ? 'amber' : backupDays >= 3 ? 'amber' : 'green';
  const backupStyles = { green: 'bg-green-50 border-green-200 text-green-800', amber: 'bg-amber-50 border-amber-200 text-amber-800', red: 'bg-red-50 border-red-200 text-red-800' }[backupTone];
  const backupText = backupDays === null ? 'No backup yet on this device — export one now to be safe.'
    : backupDays === 0 ? 'Backed up today. ✓'
    : `Last backup was ${backupDays} day${backupDays === 1 ? '' : 's'} ago${backupDays >= 7 ? ' — time to back up!' : '.'}`;

  const quickActions = [
    { title: 'New Order', href: '/orders', icon: Truck, color: 'bg-teal-500' },
    { title: 'Add Vendor', href: '/vendors', icon: Users, color: 'bg-blue-500' },
    { title: 'Create SKU', href: '/skus', icon: Package, color: 'bg-primary' },
    { title: 'Manage Customers', href: '/customers', icon: Users, color: 'bg-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      {isCheckingConnection ? (
        <div className="flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm bg-gray-50 border-gray-200 text-gray-500">
          <Cloud className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span className="font-medium">Checking cloud connection…</span>
        </div>
      ) : isCloudSynced ? (
        <div className="flex items-center gap-2 border rounded-xl px-4 py-2.5 text-sm bg-green-50 border-green-200 text-green-800">
          <Cloud className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Synced to cloud — visible on every device.</span>
        </div>
      ) : (
        <Link to="/settings" className="flex items-center justify-between gap-3 border rounded-xl px-4 py-2.5 text-sm hover:opacity-90 transition bg-red-50 border-red-200 text-red-800">
          <span className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              Running on local data only — not synced to the cloud. Other devices won't see anything entered right now.
              {connectionError ? ` (${connectionError})` : ''}
            </span>
          </span>
          <span className="text-xs font-semibold underline whitespace-nowrap">Check Settings →</span>
        </Link>
      )}

      <Link to="/settings" className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-2.5 text-sm hover:opacity-90 transition ${backupStyles}`}>
        <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span className="font-medium">{backupText}</span></span>
        <span className="text-xs font-semibold underline whitespace-nowrap">Back up now →</span>
      </Link>

      {/* Total Receivables / Payables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-bold text-gray-900 mb-1">Total Receivables</p>
          <p className="text-xs text-gray-400 mb-2">Amazon &amp; Zoho — sold, awaiting settlement</p>
          <p className="text-2xl font-bold text-amber-600">{fmt(receivables)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-bold text-gray-900 mb-1">Total Payables</p>
          <p className="text-xs text-gray-400 mb-2">Unpaid bills, vendor dues, recurring costs</p>
          <p className="text-2xl font-bold text-red-600">{fmt(payables)}</p>
        </div>
      </div>

      {/* Sales Summary — merged, toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-900">Sales Summary</h3>
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <div className="flex bg-gray-100 rounded-full p-0.5 text-xs font-medium">
              <button onClick={() => setSalesView('value')} className={`px-3 py-1 rounded-full transition ${salesView === 'value' ? 'bg-white shadow text-teal-700' : 'text-gray-500'}`}>By Value</button>
              <button onClick={() => setSalesView('orders')} className={`px-3 py-1 rounded-full transition ${salesView === 'orders' ? 'bg-white shadow text-teal-700' : 'text-gray-500'}`}>By Orders</button>
            </div>
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900 mb-2">
          {salesView === 'value' ? fmt(salesTotal) : `${monthOrders.length} orders`}
        </p>
        {monthOrders.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No orders in {monthLabel(selectedMonth)}.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={salesSeries}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(salesSeries.length / 10) - 1)} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip formatter={(v) => salesView === 'value' ? fmt(v) : `${v} orders`} labelFormatter={(l) => `Day ${l}`} />
              <Area type="monotone" dataKey={salesView} stroke="#0d9488" strokeWidth={2} fill="url(#salesGrad)" dot={{ r: 2.5, fill: '#0d9488', strokeWidth: 0 }} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Out of Stock + Pending Actions/Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Out of Stock Items</h3>
          <p className="text-3xl font-bold text-red-600 mb-1">{outOfStock.length}</p>
          <p className="text-xs text-gray-400 mb-3">SKUs at zero stock</p>
          {outOfStock.length > 0 && (
            <div className="space-y-1">
              {outOfStock.slice(0, 5).map(s => (
                <Link key={s.id} to="/ingredients" className="block text-sm text-gray-700 hover:text-red-600">{s.name}</Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4 mb-3 border-b border-gray-100">
            <button onClick={() => setActionsTab('pending')} className={`text-sm font-bold pb-2 border-b-2 -mb-px ${actionsTab === 'pending' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400'}`}>Pending Actions</button>
            <button onClick={() => setActionsTab('activity')} className={`text-sm font-bold pb-2 border-b-2 -mb-px ${actionsTab === 'activity' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400'}`}>Recent Activity</button>
          </div>
          {actionsTab === 'pending' ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Sales</p>
                <div className="space-y-1">
                  <Link to="/orders" className="flex justify-between text-gray-700 hover:text-teal-600"><span>Follow-up needed</span><span className="font-semibold">{followUpCount}</span></Link>
                  <Link to="/orders" className="flex justify-between text-gray-700 hover:text-teal-600"><span>To Be Packed (labels pending)</span><span className="font-semibold">{toBePacked}</span></Link>
                  <Link to="/orders" className="flex justify-between text-gray-700 hover:text-teal-600"><span>Packing (scan pending)</span><span className="font-semibold">{toBeShipped}</span></Link>
                  <Link to="/orders" className="flex justify-between text-gray-700 hover:text-teal-600"><span>Awaiting Courier Pickup</span><span className="font-semibold">{toBeCollected}</span></Link>
                  <Link to="/orders" className="flex justify-between text-gray-700 hover:text-teal-600"><span>To Be Delivered</span><span className="font-semibold">{toBeDelivered}</span></Link>
                  <Link to="/orders" className="flex justify-between text-gray-700 hover:text-teal-600"><span>Needs Tracking Number</span><span className="font-semibold">{needTracking}</span></Link>
                  <Link to="/invoices" className="flex justify-between text-gray-700 hover:text-teal-600"><span>To Be Invoiced</span><span className="font-semibold">{toBeInvoiced}</span></Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Purchases</p>
                <Link to="/purchase-orders" className="flex justify-between text-gray-700 hover:text-teal-600"><span>To Be Received</span><span className="font-semibold">{poPending}</span></Link>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Inventory</p>
                <Link to="/ingredients" className="flex justify-between text-gray-700 hover:text-teal-600"><span>Below Reorder Level</span><span className="font-semibold">{belowReorder}</span></Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {recentActivity.length === 0 ? <p className="text-gray-400">No recent orders.</p> : recentActivity.map(o => (
                <Link key={o.id} to="/orders" className="flex justify-between text-gray-700 hover:text-teal-600">
                  <span className="truncate">{o.customer_name || 'Customer'} — {o.status}</span>
                  <span className="text-gray-400 flex-shrink-0 ml-2">{formatDate(o.order_date)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Selling + Cash Flow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Top Selling — {monthLabel(selectedMonth)}</h3>
          {topSelling.length === 0 ? (
            <p className="text-sm text-gray-400">No sales in {monthLabel(selectedMonth)}.</p>
          ) : (
            <div className="space-y-2">
              {topSelling.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-700"><span className="text-xs text-gray-400 w-4">{i + 1}.</span>{t.name}</span>
                  <span className="text-right">
                    <span className="font-semibold text-gray-900">{t.qty} units</span>
                    {t.weekly > 0 && t.monthly > 0 && (
                      <span className="block text-[11px] text-gray-400">{t.weekly} Weekly · {t.monthly} Monthly</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-2">Cash Flow — {monthLabel(selectedMonth)}</h3>
          <div className="flex gap-4 mb-2 text-sm">
            <span className="flex items-center gap-1 text-green-600 font-semibold"><TrendingUp className="w-3.5 h-3.5" /> {fmt(cashFlow.incoming)}</span>
            <span className="flex items-center gap-1 text-red-500 font-semibold"><TrendingDown className="w-3.5 h-3.5" /> {fmt(cashFlow.outgoing)}</span>
          </div>
          {monthOrders.length === 0 && cashFlow.outgoing === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No cash movement in {monthLabel(selectedMonth)}.</p>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={cashFlow.series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(cashFlow.series.length / 8) - 1)} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Day ${l}`} />
                <Line type="monotone" dataKey="balance" stroke="#0d9488" strokeWidth={2} dot={{ r: 2.5, fill: '#0d9488', strokeWidth: 0 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Sales by Channel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-gray-700 text-sm font-bold"><PieChart className="w-4 h-4 text-teal-600" /> Sales by Channel</div>
          <Link to="/marketing" className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center">Full breakdown <ChevronRight className="w-3 h-3" /></Link>
        </div>
        {channelPerformance.length === 0 ? (
          <p className="text-sm text-gray-400">No orders yet to analyze.</p>
        ) : (
          <>
            <div className="flex w-full h-2 rounded-full overflow-hidden mb-3 bg-gray-100">
              {channelPerformance.map(c => (
                <div key={c.source} className={CHANNEL_COLORS[c.source] || 'bg-gray-400'} style={{ width: `${(c.revenue / channelPerformance.reduce((s, x) => s + x.revenue, 0)) * 100}%` }} title={`${c.label}: ${fmt(c.revenue)}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {channelPerformance.slice(0, 6).map(c => (
                <div key={c.source} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600"><span className={`w-2 h-2 rounded-full ${CHANNEL_COLORS[c.source] || 'bg-gray-400'}`} />{c.label}</span>
                  <span className="font-semibold text-gray-900">{fmt(c.revenue)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <Link key={index} to={action.href} className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group">
              <div className={`${action.color} p-1.5 rounded-lg text-white flex-shrink-0`}><action.icon className="w-4 h-4" /></div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{action.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
