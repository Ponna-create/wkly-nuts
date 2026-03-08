import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import {
  FileText, Download, Calendar, IndianRupee, Percent, TrendingUp,
  ChevronDown, ChevronUp, Building2, Share2, AlertCircle
} from 'lucide-react';

const GST_RATE = 5; // Default GST rate

export default function GSTFiling() {
  const { state, showToast } = useApp();
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expandedSection, setExpandedSection] = useState('summary');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [ordersRes, expensesRes] = await Promise.all([
        dbService.getSalesOrders(),
        dbService.getExpenses(),
      ]);
      setOrders(ordersRes.data || []);
      setExpenses(expensesRes.data || []);
      setLoading(false);
    };
    loadData();
  }, []);

  // Filter orders and expenses by selected month
  const filteredOrders = useMemo(() => {
    if (!selectedMonth) return orders;
    const [year, month] = selectedMonth.split('-');
    return orders.filter(o => {
      const date = o.order_date || o.created_at;
      if (!date) return false;
      const d = new Date(date);
      return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === parseInt(month);
    });
  }, [orders, selectedMonth]);

  const filteredExpenses = useMemo(() => {
    if (!selectedMonth) return expenses;
    const [year, month] = selectedMonth.split('-');
    return expenses.filter(e => {
      const date = e.date || e.created_at;
      if (!date) return false;
      const d = new Date(date);
      return d.getFullYear() === parseInt(year) && d.getMonth() + 1 === parseInt(month);
    });
  }, [expenses, selectedMonth]);

  // GST calculations
  const gstData = useMemo(() => {
    // Sales (Output GST) - only completed/delivered/dispatched orders
    const completedOrders = filteredOrders.filter(o =>
      ['dispatched', 'in_transit', 'delivered', 'completed'].includes(o.status)
    );

    const totalSalesRevenue = completedOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const totalSalesSubtotal = completedOrders.reduce((sum, o) => sum + (parseFloat(o.subtotal) || 0), 0);
    const outputGST = completedOrders.reduce((sum, o) => sum + (parseFloat(o.gst_amount) || 0), 0);

    // Purchases (Input GST)
    const totalPurchases = filteredExpenses
      .filter(e => e.category !== 'salary' && e.category !== 'labour')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const inputGST = totalPurchases * (GST_RATE / (100 + GST_RATE)); // Reverse calc

    // Net GST payable
    const netGST = Math.max(0, outputGST - inputGST);

    // Invoice summary
    const invoiceCount = completedOrders.length;
    const paidOrders = completedOrders.filter(o => o.payment_status === 'received');
    const unpaidOrders = completedOrders.filter(o => o.payment_status !== 'received');

    return {
      completedOrders,
      totalSalesRevenue,
      totalSalesSubtotal,
      outputGST,
      totalPurchases,
      inputGST,
      netGST,
      invoiceCount,
      paidOrders,
      unpaidOrders,
      totalPaid: paidOrders.reduce((sum, o) => sum + (parseFloat(o.amount_paid) || 0), 0),
      totalUnpaid: unpaidOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0),
    };
  }, [filteredOrders, filteredExpenses]);

  // Month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      });
    }
    return options;
  }, []);

  // Export GST report as CSV
  const exportGSTReport = () => {
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const rows = [
      ['WKLY Nuts - GST Filing Report'],
      [`Period: ${monthLabel}`],
      [`Generated: ${new Date().toLocaleDateString('en-IN')}`],
      [''],
      ['=== SALES SUMMARY ==='],
      ['Total Orders', gstData.invoiceCount],
      ['Total Revenue (incl. GST)', `₹${gstData.totalSalesRevenue.toFixed(2)}`],
      ['Taxable Amount', `₹${gstData.totalSalesSubtotal.toFixed(2)}`],
      [`Output GST (${GST_RATE}%)`, `₹${gstData.outputGST.toFixed(2)}`],
      [''],
      ['=== INPUT CREDIT ==='],
      ['Total Purchases', `₹${gstData.totalPurchases.toFixed(2)}`],
      ['Input GST Credit', `₹${gstData.inputGST.toFixed(2)}`],
      [''],
      ['=== NET GST PAYABLE ==='],
      ['Output GST', `₹${gstData.outputGST.toFixed(2)}`],
      ['(-) Input Credit', `₹${gstData.inputGST.toFixed(2)}`],
      ['Net Payable', `₹${gstData.netGST.toFixed(2)}`],
      [''],
      ['=== PAYMENT STATUS ==='],
      ['Paid Orders', gstData.paidOrders.length],
      ['Amount Received', `₹${gstData.totalPaid.toFixed(2)}`],
      ['Unpaid Orders', gstData.unpaidOrders.length],
      ['Amount Pending', `₹${gstData.totalUnpaid.toFixed(2)}`],
      [''],
      ['=== ORDER DETAILS ==='],
      ['Order #', 'Date', 'Customer', 'Subtotal', 'GST', 'Total', 'Payment Status'],
      ...gstData.completedOrders.map(o => [
        o.order_number,
        o.order_date,
        o.customer_name,
        (o.subtotal || 0).toFixed(2),
        (o.gst_amount || 0).toFixed(2),
        (o.total_amount || 0).toFixed(2),
        o.payment_status || 'pending',
      ]),
    ];

    const csv = rows.map(r => Array.isArray(r) ? r.map(c => `"${c}"`).join(',') : `"${r}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gst-report-${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('GST report exported', 'success');
  };

  // Share report text for tax person
  const shareReport = () => {
    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const text = `WKLY Nuts - GST Summary (${monthLabel})
────────────────────
Sales: ₹${gstData.totalSalesRevenue.toFixed(0)} (${gstData.invoiceCount} orders)
Taxable: ₹${gstData.totalSalesSubtotal.toFixed(0)}
Output GST: ₹${gstData.outputGST.toFixed(0)}
Input Credit: ₹${gstData.inputGST.toFixed(0)}
Net Payable: ₹${gstData.netGST.toFixed(0)}
────────────────────
Paid: ₹${gstData.totalPaid.toFixed(0)} | Pending: ₹${gstData.totalUnpaid.toFixed(0)}`;

    navigator.clipboard.writeText(text);
    showToast('GST summary copied! Share with your tax person', 'success');
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Loading tax data...</p>
      </div>
    );
  }

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST & Tax Filing</h1>
          <p className="text-gray-600 mt-1">Monthly GST summary, invoices, and tax reports</p>
        </div>
        <div className="flex gap-2">
          <button onClick={shareReport} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Share2 className="w-4 h-4" /> Copy Summary
          </button>
          <button onClick={exportGSTReport} className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-3 bg-white rounded-lg border p-3">
        <Calendar className="w-5 h-5 text-gray-500" />
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
        >
          {monthOptions.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* GST Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-blue-500 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Sales Revenue</span>
          </div>
          <p className="text-2xl font-bold">₹{gstData.totalSalesRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400">{gstData.invoiceCount} orders</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
            <Percent className="w-4 h-4" />
            <span>Output GST</span>
          </div>
          <p className="text-2xl font-bold text-red-600">₹{gstData.outputGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400">{GST_RATE}% on taxable amount</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-green-500 text-sm mb-1">
            <IndianRupee className="w-4 h-4" />
            <span>Input Credit</span>
          </div>
          <p className="text-2xl font-bold text-green-600">₹{gstData.inputGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400">From ₹{gstData.totalPurchases.toLocaleString('en-IN', { maximumFractionDigits: 0 })} purchases</p>
        </div>
        <div className={`bg-white rounded-xl p-4 shadow-sm border-2 ${gstData.netGST > 0 ? 'border-amber-300' : 'border-green-300'}`}>
          <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
            <Building2 className="w-4 h-4" />
            <span>Net GST Payable</span>
          </div>
          <p className={`text-2xl font-bold ${gstData.netGST > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            ₹{gstData.netGST.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-400">Output - Input Credit</p>
        </div>
      </div>

      {/* GST Calculation Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => toggleSection('calculation')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Percent className="w-4 h-4 text-teal-600" />
            GST Calculation
          </h3>
          {expandedSection === 'calculation' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expandedSection === 'calculation' && (
          <div className="border-t p-4 space-y-3 text-sm">
            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <p className="font-semibold text-blue-800">Output GST (collected from customers)</p>
              <div className="flex justify-between"><span>Taxable Sales</span><span>₹{gstData.totalSalesSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>GST @ {GST_RATE}%</span><span className="font-bold text-red-600">₹{gstData.outputGST.toFixed(2)}</span></div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 space-y-2">
              <p className="font-semibold text-green-800">Input GST Credit (on purchases)</p>
              <div className="flex justify-between"><span>Total Purchases</span><span>₹{gstData.totalPurchases.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Input GST Credit</span><span className="font-bold text-green-600">₹{gstData.inputGST.toFixed(2)}</span></div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border-2 border-amber-200">
              <div className="flex justify-between font-bold text-base">
                <span>Net GST Payable</span>
                <span className="text-amber-700">₹{gstData.netGST.toFixed(2)}</span>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                ₹{gstData.outputGST.toFixed(2)} (output) - ₹{gstData.inputGST.toFixed(2)} (input) = ₹{gstData.netGST.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => toggleSection('payments')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-teal-600" />
            Payment Status
          </h3>
          {expandedSection === 'payments' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expandedSection === 'payments' && (
          <div className="border-t p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium">Received</p>
                <p className="text-xl font-bold text-green-800">₹{gstData.totalPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-green-500">{gstData.paidOrders.length} orders</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-600 font-medium">Pending</p>
                <p className="text-xl font-bold text-red-800">₹{gstData.totalUnpaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-red-500">{gstData.unpaidOrders.length} orders</p>
              </div>
            </div>

            {gstData.unpaidOrders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Pending Payments</p>
                <div className="space-y-1">
                  {gstData.unpaidOrders.slice(0, 10).map(o => (
                    <div key={o.id} className="flex justify-between items-center p-2 bg-red-50 rounded text-sm">
                      <div>
                        <span className="font-medium">{o.order_number}</span>
                        <span className="text-gray-500 ml-2">{o.customer_name}</span>
                      </div>
                      <span className="font-semibold text-red-600">₹{(o.total_amount || 0).toFixed(0)}</span>
                    </div>
                  ))}
                  {gstData.unpaidOrders.length > 10 && (
                    <p className="text-xs text-gray-500 text-center">+{gstData.unpaidOrders.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => toggleSection('invoices')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            Order/Invoice Details ({gstData.completedOrders.length})
          </h3>
          {expandedSection === 'invoices' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expandedSection === 'invoices' && (
          <div className="border-t overflow-x-auto">
            {gstData.completedOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2" />
                <p>No orders for this month</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 border-b">
                    <th className="text-left p-3">Order</th>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-right p-3">Subtotal</th>
                    <th className="text-right p-3">GST</th>
                    <th className="text-right p-3">Total</th>
                    <th className="text-center p-3">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {gstData.completedOrders.map(o => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-3 font-medium">{o.order_number}</td>
                      <td className="p-3 text-gray-500">{o.order_date ? new Date(o.order_date).toLocaleDateString('en-IN') : '-'}</td>
                      <td className="p-3">{o.customer_name}</td>
                      <td className="p-3 text-right">₹{(o.subtotal || 0).toFixed(0)}</td>
                      <td className="p-3 text-right text-red-600">₹{(o.gst_amount || 0).toFixed(0)}</td>
                      <td className="p-3 text-right font-semibold">₹{(o.total_amount || 0).toFixed(0)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          o.payment_status === 'received' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {o.payment_status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan="3" className="p-3">Total</td>
                    <td className="p-3 text-right">₹{gstData.totalSalesSubtotal.toFixed(0)}</td>
                    <td className="p-3 text-right text-red-600">₹{gstData.outputGST.toFixed(0)}</td>
                    <td className="p-3 text-right">₹{gstData.totalSalesRevenue.toFixed(0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <strong>Note:</strong> GST rate is currently set at {GST_RATE}%. This is an estimated summary for your tax person.
          Actual GST filing should be done through your GST portal. Use "Copy Summary" or "Export CSV" to share with your accountant.
        </p>
      </div>
    </div>
  );
}
