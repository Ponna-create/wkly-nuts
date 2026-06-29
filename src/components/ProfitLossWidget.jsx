import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, IndianRupee, ArrowRight } from 'lucide-react';
import { dbService } from '../services/supabase';

export default function ProfitLossWidget() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const [ordersRes, expensesRes, prodRes] = await Promise.all([
        dbService.getSalesOrders(),
        dbService.getExpenses(),
        dbService.getProductionRuns(),
      ]);

      const orders = (ordersRes.data || []).filter(o => {
        const d = o.order_date || o.created_at?.split('T')[0];
        return d >= monthStart && d <= today;
      });
      const expenses = (expensesRes.data || []).filter(e => {
        const d = e.expense_date || e.created_at?.split('T')[0];
        return d >= monthStart && d <= today;
      });
      const productions = (prodRes.data || []).filter(p => {
        const d = p.batch_date || p.created_at?.split('T')[0];
        return d >= monthStart && d <= today;
      });

      const revenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
      const expenseTotal = expenses.reduce((s, e) => s + (e.total_amount || e.amount || 0), 0);
      const prodCost = productions.reduce((s, p) => s + (p.total_cost || 0), 0);
      const profit = revenue - expenseTotal - prodCost;
      const orderCount = orders.length;

      setData({ revenue, expenseTotal, prodCost, profit, orderCount });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return null;
  if (!data || (data.revenue === 0 && data.expenseTotal === 0)) return null;

  const { revenue, expenseTotal, prodCost, profit, orderCount } = data;
  const isProfit = profit >= 0;
  const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const fmt = (v) => Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-teal-600" />
          P&L — {month}
        </h3>
        <Link to="/reports" className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
          Full Report <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-green-50 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase">Revenue</p>
          <p className="text-sm font-bold text-green-700">₹{fmt(revenue)}</p>
          <p className="text-[10px] text-gray-400">{orderCount} orders</p>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase">Expenses</p>
          <p className="text-sm font-bold text-red-600">₹{fmt(expenseTotal)}</p>
        </div>
        <div className="text-center p-2 bg-orange-50 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase">Prod Cost</p>
          <p className="text-sm font-bold text-orange-600">₹{fmt(prodCost)}</p>
        </div>
      </div>

      <div className={`flex items-center justify-between p-3 rounded-lg ${isProfit ? 'bg-green-100' : 'bg-red-100'}`}>
        <div className="flex items-center gap-2">
          {isProfit ? <TrendingUp className="w-5 h-5 text-green-700" /> : <TrendingDown className="w-5 h-5 text-red-700" />}
          <span className={`text-sm font-medium ${isProfit ? 'text-green-800' : 'text-red-800'}`}>
            {isProfit ? 'Net Profit' : 'Net Loss'}
          </span>
        </div>
        <span className={`text-lg font-bold ${isProfit ? 'text-green-700' : 'text-red-700'}`}>
          {isProfit ? '' : '-'}₹{fmt(profit)}
        </span>
      </div>
    </div>
  );
}
