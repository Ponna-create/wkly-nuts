import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Package, ShoppingCart, Calendar, Download, IndianRupee, Factory, Users, Target, Wallet } from 'lucide-react';
import { dbService } from '../services/supabase';
import { useApp } from '../context/AppContext';

// Simple bar chart component (no external library)
function SimpleBar({ label, value, maxValue, color = 'bg-teal-500' }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 text-gray-600 truncate text-right">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div className={`h-full ${color} rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
          style={{ width: `${Math.max(pct, 2)}%` }}>
          {pct > 15 && <span className="text-xs text-white font-medium">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</span>}
        </div>
      </div>
      {pct <= 15 && <span className="text-xs text-gray-600 font-medium w-16">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</span>}
    </div>
  );
}

export default function Reports() {
  const { state } = useApp();
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [productions, setProductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [ordersRes, expensesRes, prodRes] = await Promise.all([
      dbService.getSalesOrders(),
      dbService.getExpenses(),
      dbService.getProductionRuns(),
    ]);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (expensesRes.data) setExpenses(expensesRes.data);
    if (prodRes.data) setProductions(prodRes.data);
    setLoading(false);
  };

  // Date range filter
  const getDateRange = () => {
    const now = new Date();
    let from, to;
    switch (dateRange) {
      case 'today':
        from = to = now.toISOString().split('T')[0];
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).toISOString().split('T')[0];
        to = now.toISOString().split('T')[0];
        break;
      case 'this_month':
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        to = now.toISOString().split('T')[0];
        break;
      case 'last_month':
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'this_year':
        from = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        to = now.toISOString().split('T')[0];
        break;
      case 'all_time':
        from = '2020-01-01';
        to = now.toISOString().split('T')[0];
        break;
      case 'custom':
        from = customFrom || '2020-01-01';
        to = customTo || now.toISOString().split('T')[0];
        break;
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        to = now.toISOString().split('T')[0];
    }
    return { from, to };
  };

  const { from: rangeFrom, to: rangeTo } = getDateRange();

  const filteredOrders = useMemo(() =>
    orders.filter(o => {
      const d = o.order_date || o.created_at?.split('T')[0];
      return d >= rangeFrom && d <= rangeTo;
    }), [orders, rangeFrom, rangeTo]);

  const filteredExpenses = useMemo(() =>
    expenses.filter(e => {
      const d = e.expense_date || e.created_at?.split('T')[0];
      return d >= rangeFrom && d <= rangeTo;
    }), [expenses, rangeFrom, rangeTo]);

  const filteredProductions = useMemo(() =>
    productions.filter(p => {
      const d = p.batch_date || p.created_at?.split('T')[0];
      return d >= rangeFrom && d <= rangeTo;
    }), [productions, rangeFrom, rangeTo]);

  // === SALES METRICS ===
  const salesMetrics = useMemo(() => {
    const total = filteredOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const count = filteredOrders.length;
    const delivered = filteredOrders.filter(o => o.status === 'delivered' || o.status === 'completed').length;
    const cancelled = filteredOrders.filter(o => o.status === 'cancelled').length;
    const avgValue = count > 0 ? total / count : 0;

    // By source
    const bySource = {};
    filteredOrders.forEach(o => {
      const src = o.order_source || 'direct';
      bySource[src] = (bySource[src] || 0) + 1;
    });

    // By status
    const byStatus = {};
    filteredOrders.forEach(o => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    // Top customers
    const byCustomer = {};
    filteredOrders.forEach(o => {
      const name = o.customer_name || 'Unknown';
      if (!byCustomer[name]) byCustomer[name] = { count: 0, amount: 0 };
      byCustomer[name].count++;
      byCustomer[name].amount += (o.total_amount || 0);
    });
    const topCustomers = Object.entries(byCustomer)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return { total, count, delivered, cancelled, avgValue, bySource, byStatus, topCustomers };
  }, [filteredOrders]);

  // === EXPENSE METRICS ===
  const expenseMetrics = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + (e.total_amount || e.amount || 0), 0);
    const count = filteredExpenses.length;

    const byCategory = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'misc';
      byCategory[cat] = (byCategory[cat] || 0) + (e.total_amount || e.amount || 0);
    });

    const topCategories = Object.entries(byCategory)
      .map(([cat, amount]) => ({ cat, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { total, count, byCategory, topCategories };
  }, [filteredExpenses]);

  // === PRODUCTION METRICS ===
  const productionMetrics = useMemo(() => {
    const runs = filteredProductions.length;
    const completed = filteredProductions.filter(p => p.status === 'completed').length;
    const totalUnits = filteredProductions.reduce((s, p) => s + (p.actual_quantity || 0), 0);
    const totalCost = filteredProductions.reduce((s, p) => s + (p.total_cost || 0), 0);

    const bySku = {};
    filteredProductions.forEach(p => {
      const name = p.sku_name || p.sku_code || 'Unknown';
      if (!bySku[name]) bySku[name] = { count: 0, units: 0, cost: 0 };
      bySku[name].count++;
      bySku[name].units += (p.actual_quantity || 0);
      bySku[name].cost += (p.total_cost || 0);
    });

    const bySkuArr = Object.entries(bySku)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.units - a.units);

    return { runs, completed, totalUnits, totalCost, bySkuArr };
  }, [filteredProductions]);

  // === PROFIT/LOSS ===
  const netProfit = salesMetrics.total - expenseMetrics.total - productionMetrics.totalCost;

  // === MONTHLY TREND (last 6 months, uses all orders not filtered) ===
  const monthlyTrend = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const monthOrders = orders.filter(o => {
        const od = o.order_date || o.created_at?.split('T')[0];
        return od && od.startsWith(key);
      });
      const monthExpenses = expenses.filter(e => {
        const ed = e.expense_date || e.created_at?.split('T')[0];
        return ed && ed.startsWith(key);
      });
      const revenue = monthOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const expense = monthExpenses.reduce((s, e) => s + (e.total_amount || e.amount || 0), 0);
      months.push({ key, label, revenue, expense, profit: revenue - expense, orderCount: monthOrders.length });
    }
    return months;
  }, [orders, expenses]);

  // === CUSTOMER RETENTION ===
  const customerRetention = useMemo(() => {
    // Customers who ordered in the filtered period
    const periodCustomers = new Set(filteredOrders.map(o => (o.customer_name || '').toLowerCase().trim()).filter(Boolean));
    // All customers who ordered BEFORE the filtered period
    const priorCustomers = new Set(
      orders.filter(o => {
        const d = o.order_date || o.created_at?.split('T')[0];
        return d && d < rangeFrom;
      }).map(o => (o.customer_name || '').toLowerCase().trim()).filter(Boolean)
    );
    const repeatCustomers = [...periodCustomers].filter(c => priorCustomers.has(c));
    const newCustomers = [...periodCustomers].filter(c => !priorCustomers.has(c));

    // Repeat order frequency
    const orderCounts = {};
    filteredOrders.forEach(o => {
      const name = (o.customer_name || '').toLowerCase().trim();
      if (name) orderCounts[name] = (orderCounts[name] || 0) + 1;
    });
    const multiOrderCustomers = Object.values(orderCounts).filter(c => c > 1).length;

    return {
      total: periodCustomers.size,
      repeat: repeatCustomers.length,
      new: newCustomers.length,
      multiOrder: multiOrderCustomers,
      repeatRate: periodCustomers.size > 0 ? ((repeatCustomers.length / periodCustomers.size) * 100).toFixed(0) : 0,
    };
  }, [filteredOrders, orders, rangeFrom]);

  // === BREAKEVEN ANALYSIS ===
  const breakeven = useMemo(() => {
    const totalFixedCosts = expenseMetrics.total + productionMetrics.totalCost;
    const avgOrderValue = salesMetrics.avgValue;
    const ordersNeeded = avgOrderValue > 0 ? Math.ceil(totalFixedCosts / avgOrderValue) : 0;
    const currentOrders = salesMetrics.count;
    const progress = ordersNeeded > 0 ? Math.min((currentOrders / ordersNeeded) * 100, 100) : 0;
    const remaining = Math.max(0, ordersNeeded - currentOrders);
    const revenueNeeded = totalFixedCosts;
    const revenueProgress = revenueNeeded > 0 ? Math.min((salesMetrics.total / revenueNeeded) * 100, 100) : 0;

    return { totalFixedCosts, avgOrderValue, ordersNeeded, currentOrders, progress, remaining, revenueNeeded, revenueProgress };
  }, [expenseMetrics, productionMetrics, salesMetrics]);

  // === CASH FLOW ===
  const cashFlow = useMemo(() => {
    const received = filteredOrders.filter(o => o.payment_status === 'received').reduce((s, o) => s + (o.amount_paid || o.total_amount || 0), 0);
    const pending = filteredOrders.filter(o => o.payment_status !== 'received').reduce((s, o) => s + (o.total_amount || 0), 0);
    const totalExpensePaid = filteredExpenses.reduce((s, e) => s + (e.total_amount || e.amount || 0), 0);
    const netCashFlow = received - totalExpensePaid;
    return { received, pending, totalExpensePaid, netCashFlow };
  }, [filteredOrders, filteredExpenses]);

  const SOURCE_LABELS = { whatsapp: 'WhatsApp', website: 'Website', instagram: 'Instagram', meta_ad: 'Meta Ads', walkin: 'Walk-in', zoho: 'Zoho', direct: 'Direct' };
  const STATUS_LABELS = { follow_up: 'Follow-up', packing: 'Packing', packed: 'Packed', dispatched: 'Dispatched', in_transit: 'In Transit', delivered: 'Delivered', completed: 'Completed', cancelled: 'Cancelled', returned: 'Returned' };
  const CATEGORY_LABELS = { raw_materials: 'Raw Materials', packaging: 'Packaging', shipping: 'Shipping', advertising: 'Advertising', rent: 'Rent', utilities: 'Utilities', equipment: 'Equipment', salary: 'Salary', courier: 'Courier', misc: 'Miscellaneous' };

  if (loading) return <div className="text-center py-12"><p className="text-gray-500">Loading reports...</p></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Business overview and performance metrics</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          {[
            { label: 'Today', value: 'today' },
            { label: 'This Week', value: 'this_week' },
            { label: 'This Month', value: 'this_month' },
            { label: 'Last Month', value: 'last_month' },
            { label: 'This Year', value: 'this_year' },
            { label: 'All Time', value: 'all_time' },
            { label: 'Custom', value: 'custom' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setDateRange(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                dateRange === opt.value ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <div className="flex gap-3 mt-3">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
            <span className="text-gray-500 self-center">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee className="w-4 h-4 text-green-600" />
            <p className="text-sm text-gray-600">Revenue</p>
          </div>
          <p className="text-2xl font-bold text-green-700">{salesMetrics.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-500">{salesMetrics.count} orders</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-4 h-4 text-red-600" />
            <p className="text-sm text-gray-600">Expenses</p>
          </div>
          <p className="text-2xl font-bold text-red-700">{expenseMetrics.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-500">{expenseMetrics.count} entries</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Factory className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-gray-600">Production Cost</p>
          </div>
          <p className="text-2xl font-bold text-blue-700">{productionMetrics.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-500">{productionMetrics.totalUnits} units</p>
        </div>
        <div className={`p-4 rounded-lg border ${netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4" />
            <p className="text-sm text-gray-600">Net P&L</p>
          </div>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {netProfit >= 0 ? '' : '-'}{Math.abs(netProfit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500">Revenue - Expenses - Production</p>
        </div>
      </div>

      {/* Sales Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders by Status</h3>
          <div className="space-y-2">
            {Object.entries(salesMetrics.byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <SimpleBar key={status} label={STATUS_LABELS[status] || status}
                  value={count} maxValue={salesMetrics.count} color="bg-teal-500" />
              ))}
            {Object.keys(salesMetrics.byStatus).length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No orders in this period</p>
            )}
          </div>
        </div>

        {/* Orders by Source */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders by Source</h3>
          <div className="space-y-2">
            {Object.entries(salesMetrics.bySource)
              .sort(([, a], [, b]) => b - a)
              .map(([source, count]) => (
                <SimpleBar key={source} label={SOURCE_LABELS[source] || source}
                  value={count} maxValue={Math.max(...Object.values(salesMetrics.bySource))} color="bg-blue-500" />
              ))}
            {Object.keys(salesMetrics.bySource).length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No orders in this period</p>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers (by Revenue)</h3>
          <div className="space-y-2">
            {salesMetrics.topCustomers.map((c, i) => (
              <SimpleBar key={i} label={c.name}
                value={c.amount} maxValue={salesMetrics.topCustomers[0]?.amount || 1} color="bg-purple-500" />
            ))}
            {salesMetrics.topCustomers.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No customers in this period</p>
            )}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h3>
          <div className="space-y-2">
            {expenseMetrics.topCategories.map(({ cat, amount }) => (
              <SimpleBar key={cat} label={CATEGORY_LABELS[cat] || cat}
                value={amount} maxValue={expenseMetrics.topCategories[0]?.amount || 1} color="bg-red-400" />
            ))}
            {expenseMetrics.topCategories.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No expenses in this period</p>
            )}
          </div>
        </div>

        {/* Production by SKU */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Production by SKU (Units)</h3>
          <div className="space-y-2">
            {productionMetrics.bySkuArr.map(s => (
              <SimpleBar key={s.name} label={s.name}
                value={s.units} maxValue={productionMetrics.bySkuArr[0]?.units || 1} color="bg-orange-500" />
            ))}
            {productionMetrics.bySkuArr.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No production in this period</p>
            )}
          </div>
        </div>

        {/* Cash Flow */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-teal-600" /> Cash Flow
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Payments Received</span>
              <span className="font-bold text-green-700">₹{cashFlow.received.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Payments Pending</span>
              <span className="font-bold text-amber-700">₹{cashFlow.pending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Total Expenses Paid</span>
              <span className="font-bold text-red-700">₹{cashFlow.totalExpensePaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className={`flex justify-between py-2 px-3 rounded-lg ${cashFlow.netCashFlow >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className="font-semibold">Net Cash Flow</span>
              <span className={`font-bold text-lg ${cashFlow.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {cashFlow.netCashFlow >= 0 ? '+' : ''}₹{cashFlow.netCashFlow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Avg Order Value</span>
              <span className="font-bold text-gray-900">{salesMetrics.avgValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Delivery Rate</span>
              <span className="font-bold text-gray-900">
                {salesMetrics.count > 0 ? ((salesMetrics.delivered / salesMetrics.count) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Cancellation Rate</span>
              <span className="font-bold text-gray-900">
                {salesMetrics.count > 0 ? ((salesMetrics.cancelled / salesMetrics.count) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Production Completion</span>
              <span className="font-bold text-gray-900">
                {productionMetrics.runs > 0 ? ((productionMetrics.completed / productionMetrics.runs) * 100).toFixed(0) : 0}%
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Avg Production Cost/Unit</span>
              <span className="font-bold text-gray-900">
                {productionMetrics.totalUnits > 0 ? (productionMetrics.totalCost / productionMetrics.totalUnits).toFixed(2) : '0'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Profit Margin</span>
              <span className={`font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {salesMetrics.total > 0 ? ((netProfit / salesMetrics.total) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Trend (last 6 months) */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-600" /> Monthly Revenue Trend (Last 6 Months)
        </h3>
        <div className="flex items-end gap-2 h-48">
          {monthlyTrend.map((m) => {
            const maxVal = Math.max(...monthlyTrend.map(t => Math.max(t.revenue, t.expense)), 1);
            const revHeight = (m.revenue / maxVal) * 100;
            const expHeight = (m.expense / maxVal) * 100;
            return (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5" style={{ height: '160px' }}>
                  <div className="flex-1 bg-green-400 rounded-t transition-all duration-500" style={{ height: `${Math.max(revHeight, 2)}%` }} title={`Revenue: ₹${m.revenue.toLocaleString('en-IN')}`} />
                  <div className="flex-1 bg-red-300 rounded-t transition-all duration-500" style={{ height: `${Math.max(expHeight, 2)}%` }} title={`Expenses: ₹${m.expense.toLocaleString('en-IN')}`} />
                </div>
                <span className="text-xs text-gray-500 font-medium">{m.label}</span>
                <span className="text-[10px] text-gray-400">{m.orderCount} ord</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 justify-center">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-400 rounded" /><span className="text-xs text-gray-500">Revenue</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-300 rounded" /><span className="text-xs text-gray-500">Expenses</span></div>
        </div>
      </div>

      {/* Customer Retention & Breakeven side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Retention */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" /> Customer Retention
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{customerRetention.total}</p>
              <p className="text-xs text-blue-500">Total Customers</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{customerRetention.repeat}</p>
              <p className="text-xs text-green-500">Repeat Customers</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">{customerRetention.new}</p>
              <p className="text-xs text-purple-500">New Customers</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{customerRetention.repeatRate}%</p>
              <p className="text-xs text-amber-500">Repeat Rate</p>
            </div>
          </div>
          {customerRetention.total > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>New vs Repeat</span>
                <span>{customerRetention.new} new / {customerRetention.repeat} repeat</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-purple-400 h-full transition-all" style={{ width: `${customerRetention.total > 0 ? (customerRetention.new / customerRetention.total) * 100 : 0}%` }} />
                <div className="bg-green-400 h-full transition-all" style={{ width: `${customerRetention.total > 0 ? (customerRetention.repeat / customerRetention.total) * 100 : 0}%` }} />
              </div>
              <div className="flex gap-3 mt-1 justify-center">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-400 rounded" /><span className="text-[10px] text-gray-500">New</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-400 rounded" /><span className="text-[10px] text-gray-500">Repeat</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Breakeven Analysis */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-teal-600" /> Breakeven Analysis
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Revenue vs Costs</span>
                <span className={`font-semibold ${breakeven.revenueProgress >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                  {breakeven.revenueProgress.toFixed(0)}%
                </span>
              </div>
              <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${breakeven.revenueProgress >= 100 ? 'bg-green-500' : 'bg-amber-400'}`}
                  style={{ width: `${breakeven.revenueProgress}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>₹{salesMetrics.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })} earned</span>
                <span>₹{breakeven.revenueNeeded.toLocaleString('en-IN', { maximumFractionDigits: 0 })} needed</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Costs (Expenses + Production)</span>
                <span className="font-semibold">₹{breakeven.totalFixedCosts.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Order Value</span>
                <span className="font-semibold">₹{breakeven.avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-600">Orders Needed to Break Even</span>
                <span className="font-bold text-lg">{breakeven.ordersNeeded}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Orders</span>
                <span className="font-semibold text-teal-600">{breakeven.currentOrders}</span>
              </div>
              {breakeven.remaining > 0 ? (
                <div className="flex justify-between bg-amber-50 px-2 py-1 rounded">
                  <span className="text-amber-700 font-medium">Still Need</span>
                  <span className="font-bold text-amber-700">{breakeven.remaining} more orders</span>
                </div>
              ) : (
                <div className="flex justify-between bg-green-50 px-2 py-1 rounded">
                  <span className="text-green-700 font-medium">Status</span>
                  <span className="font-bold text-green-700">Breakeven Achieved!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
