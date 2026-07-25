import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Package, TrendingUp, Truck, AlertCircle, Clock, Send, Wallet, PieChart, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import StockAlerts from '../components/StockAlerts';
import LapsedCustomers from '../components/LapsedCustomers';
import ProfitLossWidget from '../components/ProfitLossWidget';

const SOURCE_LABELS = {
  whatsapp: 'WhatsApp', website: 'Website', instagram: 'Instagram', inst: 'Instagram',
  meta_ad: 'Meta Ads', amazon: 'Amazon', zoho: 'Zoho', direct: 'Direct',
  collab: 'Collab', promotion: 'Promotion', referral: 'Referral', other: 'Other',
};

// Channels that pay out on a settlement cycle, not at order time
const DELAYED_PAYMENT_CHANNELS = ['amazon', 'zoho'];

const CHANNEL_COLORS = {
  whatsapp: 'bg-green-500', direct: 'bg-teal-500', website: 'bg-blue-500', zoho: 'bg-indigo-500',
  amazon: 'bg-orange-500', instagram: 'bg-pink-500', inst: 'bg-pink-500', meta_ad: 'bg-purple-500',
  collab: 'bg-yellow-500', promotion: 'bg-cyan-500', referral: 'bg-lime-500', other: 'bg-gray-400',
};

export default function Dashboard() {
  const { state } = useApp();
  const { salesOrders } = state;
  const orders = salesOrders || [];
  const [lowStockCount, setLowStockCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    dbService.getLowStockAlerts()
      .then(data => { if (!cancelled) setLowStockCount((data || []).length); })
      .catch(() => { if (!cancelled) setLowStockCount(null); });
    return () => { cancelled = true; };
  }, []);

  // Order pipeline stats
  const orderPipeline = [
    { label: 'Follow-up', count: orders.filter(o => o.status === 'follow_up').length, color: 'bg-blue-500', href: '/orders' },
    { label: 'Packing', count: orders.filter(o => o.status === 'packing').length, color: 'bg-yellow-500', href: '/orders' },
    { label: 'Packed', count: orders.filter(o => o.status === 'packed').length, color: 'bg-orange-500', href: '/orders' },
    { label: 'Dispatched', count: orders.filter(o => o.status === 'dispatched').length, color: 'bg-purple-500', href: '/orders' },
    { label: 'In Transit', count: orders.filter(o => o.status === 'in_transit').length, color: 'bg-indigo-500', href: '/orders' },
    { label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length, color: 'bg-green-500', href: '/orders' },
  ];
  const totalOrders = orders.length;
  const todayRevenue = orders
    .filter(o => o.order_date === new Date().toISOString().split('T')[0])
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Needs Attention today — cheap, real numbers, no separate fetch
  const followUpCount = orders.filter(o => o.status === 'follow_up').length;
  const needsTrackingCount = orders.filter(o => ['dispatched', 'in_transit'].includes(o.status) && !o.tracking_number).length;

  // Sales by channel — top channels by revenue
  const channelPerformance = useMemo(() => {
    const bySource = {};
    orders.forEach(o => {
      const src = o.order_source || 'other';
      if (!bySource[src]) bySource[src] = { orders: 0, revenue: 0 };
      bySource[src].orders += 1;
      bySource[src].revenue += parseFloat(o.total_amount) || 0;
    });
    return Object.entries(bySource)
      .map(([source, v]) => ({ source, label: SOURCE_LABELS[source] || source, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  // Payments pending — Amazon/Zoho orders not yet marked received
  const paymentsPending = useMemo(() => {
    const pending = orders.filter(o =>
      DELAYED_PAYMENT_CHANNELS.includes(o.order_source) && o.payment_status !== 'received'
    );
    const bySource = {};
    pending.forEach(o => {
      const src = o.order_source;
      bySource[src] = (bySource[src] || 0) + (parseFloat(o.total_amount) || 0);
    });
    const total = pending.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    return { count: pending.length, total, bySource };
  }, [orders]);

  // Backup reminder — days since the last export on this device
  const lastBackupRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('wklyNutsLastBackup') : null;
  const backupDays = lastBackupRaw ? Math.floor((Date.now() - new Date(lastBackupRaw).getTime()) / 86400000) : null;
  const backupTone = backupDays === null ? 'red' : backupDays >= 7 ? 'amber' : backupDays >= 3 ? 'amber' : 'green';
  const backupStyles = {
    green: 'bg-green-50 border-green-200 text-green-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }[backupTone];
  const backupText = backupDays === null
    ? 'No backup yet on this device — export one now to be safe.'
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
      {/* Backup reminder */}
      <Link to="/settings" className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-2.5 text-sm hover:opacity-90 transition ${backupStyles}`}>
        <span className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">{backupText}</span>
        </span>
        <span className="text-xs font-semibold underline whitespace-nowrap">Back up now →</span>
      </Link>

      {/* Needs Attention Today */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link to="/orders" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-blue-200 transition">
          <div className="flex items-center gap-2 text-blue-500 text-xs font-medium mb-1"><Clock className="w-3.5 h-3.5" /> Follow-ups</div>
          <p className="text-2xl font-bold text-gray-900">{followUpCount}</p>
          <p className="text-xs text-gray-400">need confirmation</p>
        </Link>
        <Link to="/orders" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-purple-200 transition">
          <div className="flex items-center gap-2 text-purple-500 text-xs font-medium mb-1"><Send className="w-3.5 h-3.5" /> Need Tracking</div>
          <p className="text-2xl font-bold text-gray-900">{needsTrackingCount}</p>
          <p className="text-xs text-gray-400">dispatched, no number</p>
        </Link>
        <Link to="/ingredients" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-red-200 transition">
          <div className="flex items-center gap-2 text-red-500 text-xs font-medium mb-1"><AlertCircle className="w-3.5 h-3.5" /> Low Stock</div>
          <p className="text-2xl font-bold text-gray-900">{lowStockCount === null ? '—' : lowStockCount}</p>
          <p className="text-xs text-gray-400">items below reorder</p>
        </Link>
        <Link to="/reports" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-teal-200 transition">
          <div className="flex items-center gap-2 text-teal-500 text-xs font-medium mb-1"><TrendingUp className="w-3.5 h-3.5" /> Today's Revenue</div>
          <p className="text-2xl font-bold text-gray-900">₹{todayRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400">{totalOrders} orders total</p>
        </Link>
      </div>

      {/* Order Pipeline */}
      {totalOrders > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Order Pipeline</h3>
            <Link to="/orders" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
              View All ({totalOrders})
            </Link>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {orderPipeline.map((step) => (
              <Link key={step.label} to={step.href} className="text-center group">
                <div className={`${step.color} text-white text-xl font-bold rounded-lg p-3 group-hover:opacity-90 transition`}>
                  {step.count}
                </div>
                <p className="text-xs text-gray-600 mt-1 font-medium">{step.label}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Payments Pending + Sales by Channel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-amber-50 rounded-lg shadow-sm border border-amber-200 p-4">
          <div className="flex items-center gap-2 text-amber-700 text-sm font-bold mb-3">
            <Wallet className="w-4 h-4" /> Payments Pending — Amazon &amp; Zoho
          </div>
          {paymentsPending.count === 0 ? (
            <p className="text-sm text-amber-700/70">Nothing awaiting settlement right now.</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-amber-900">₹{paymentsPending.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-amber-700 mb-2">{paymentsPending.count} order{paymentsPending.count === 1 ? '' : 's'} sold but not yet paid out</p>
              <div className="space-y-1 text-xs text-amber-800">
                {Object.entries(paymentsPending.bySource).map(([src, amt]) => (
                  <div key={src} className="flex justify-between">
                    <span>{SOURCE_LABELS[src] || src}</span>
                    <span className="font-semibold">₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-gray-700 text-sm font-bold">
              <PieChart className="w-4 h-4 text-teal-600" /> Sales by Channel
            </div>
            <Link to="/marketing" className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center">
              Full breakdown <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {channelPerformance.length === 0 ? (
            <p className="text-sm text-gray-400">No orders yet to analyze.</p>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-900 mb-1">
                ₹{channelPerformance.reduce((s, c) => s + c.revenue, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                <span className="text-xs font-normal text-gray-400 ml-1">total sales</span>
              </p>
              <div className="flex w-full h-2 rounded-full overflow-hidden mb-3 bg-gray-100">
                {channelPerformance.map(c => (
                  <div
                    key={c.source}
                    className={CHANNEL_COLORS[c.source] || 'bg-gray-400'}
                    style={{ width: `${(c.revenue / channelPerformance.reduce((s, x) => s + x.revenue, 0)) * 100}%` }}
                    title={`${c.label}: ₹${c.revenue.toLocaleString('en-IN')}`}
                  />
                ))}
              </div>
              <div className="space-y-1.5">
                {channelPerformance.slice(0, 4).map(c => (
                  <div key={c.source} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <span className={`w-2 h-2 rounded-full ${CHANNEL_COLORS[c.source] || 'bg-gray-400'}`} />
                      {c.label}
                    </span>
                    <span className="font-semibold text-gray-900">₹{c.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* P&L Widget */}
      <ProfitLossWidget />

      {/* Stock Alerts */}
      <StockAlerts compact={false} showTitle={true} />

      {/* Lapsed Customers */}
      <LapsedCustomers />

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.href}
              className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className={`${action.color} p-1.5 rounded-lg text-white flex-shrink-0`}>
                <action.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                {action.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
