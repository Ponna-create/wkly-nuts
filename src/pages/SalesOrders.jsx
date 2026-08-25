import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Trash2, Zap, Camera, FileSpreadsheet, MessageCircle, Truck, Printer, LayoutGrid, ClipboardList, CheckCircle2 } from 'lucide-react';
import DeleteOrderPanel from '../components/sales/DeleteOrderPanel';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { formatDate } from '../utils/dateFormat';
import DateRangePicker from '../components/common/DateRangePicker';
import NewOrderForm from '../components/sales/NewOrderForm';
import OrderDetailView from '../components/sales/OrderDetailView';
import BulkTrackingEntry from '../components/sales/BulkTrackingEntry';
import TrackingScanner from '../components/sales/TrackingScanner';
import BulkWhatsAppSend from '../components/sales/BulkWhatsAppSend';
import QRScanner from '../components/sales/QRScanner';
import ZohoImport from '../components/sales/ZohoImport';
import TrackingCSVImport from '../components/sales/TrackingCSVImport';
import TrackingChecker from '../components/sales/TrackingChecker';
import BulkLabelPrint from '../components/sales/BulkLabelPrint';
import A4LabelSheet from '../components/sales/A4LabelSheet';
import CourierDashboard from '../components/sales/CourierDashboard';
import { fillTemplate, loadTemplates } from '../components/sales/WhatsAppSender';
import { getStuckInfo } from '../utils/orderAging';

export default function SalesOrders() {
  const { state, dispatch, showToast } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [showTrackingEntry, setShowTrackingEntry] = useState(false);
  const [showTrackingScanner, setShowTrackingScanner] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showZohoImport, setShowZohoImport] = useState(false);
  const [showTrackingImport, setShowTrackingImport] = useState(false);
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false);
  const [showTrackingChecker, setShowTrackingChecker] = useState(false);
  const [showBulkLabelPrint, setShowBulkLabelPrint] = useState(false);
  const [showA4LabelSheet, setShowA4LabelSheet] = useState(false);
  const [showCourierDashboard, setShowCourierDashboard] = useState(false);
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Status tabs — 8-stage pipeline: Follow-up -> Confirmed -> Packing -> Fulfilled -> Collected -> Dispatched -> Transit -> Delivered
  const statusTabs = [
    { label: 'All', value: 'all', color: 'bg-gray-100', count: orders.length },
    { label: 'Follow-up', value: 'follow_up', color: 'bg-blue-100', count: orders.filter(o => o.status === 'follow_up').length },
    { label: 'Confirmed', value: 'confirmed', color: 'bg-cyan-100', count: orders.filter(o => o.status === 'confirmed').length },
    { label: 'Packing', value: 'packing', color: 'bg-yellow-100', count: orders.filter(o => o.status === 'packing').length },
    { label: 'Fulfilled', value: 'fulfilled', color: 'bg-orange-100', count: orders.filter(o => o.status === 'fulfilled').length },
    { label: 'Collected', value: 'collected', color: 'bg-pink-100', count: orders.filter(o => o.status === 'collected').length },
    { label: 'Dispatched', value: 'dispatched', color: 'bg-purple-100', count: orders.filter(o => o.status === 'dispatched').length },
    { label: 'In Transit', value: 'transit', color: 'bg-indigo-100', count: orders.filter(o => o.status === 'transit').length },
    { label: 'Delivered', value: 'delivered', color: 'bg-green-100', count: orders.filter(o => o.status === 'delivered').length },
  ];

  useEffect(() => {
    loadOrders();
    // Safety-net cleanup for stored Amazon PDFs left past their 25-day window
    // — not a cron job, just runs opportunistically whenever this page loads.
    dbService.purgeExpiredAmazonDocuments().catch(() => {});
    // ST Courier status check is now a manual, visible trigger (Delivery
    // Tracking & Feedback tab) instead of a silent background call — no way
    // to tell if a silent one worked, and it was silently failing (AWB
    // length bug). See TrackingChecker.jsx.
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    const { data, error } = await dbService.getSalesOrders();
    if (error) {
      showToast('Error loading orders', 'error');
      console.error(error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch =
      (order.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.shipping_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const od = order.order_date || '';
    const matchesDate = (!dateFrom || od >= dateFrom) && (!dateTo || od <= dateTo);
    return matchesStatus && matchesSearch && matchesDate;
  });

  const getStatusBadge = (status) => {
    const badges = {
      follow_up: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Follow-up' },
      awaiting_payment: { bg: 'bg-red-100', text: 'text-red-800', label: 'Awaiting Payment' },
      confirmed: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Confirmed' },
      packing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Packing' },
      fulfilled: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Fulfilled' },
      collected: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Collected by Courier' },
      dispatched: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Dispatched' },
      transit: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'In Transit' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
      completed: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Completed' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
      returned: { bg: 'bg-rose-100', text: 'text-rose-800', label: 'Returned' },
    };
    return badges[status] || badges.confirmed;
  };

  const getSourceIcon = (source) => {
    const icons = {
      whatsapp: '💬',
      website: '🌐',
      instagram: '📷',
      meta_ad: '📢',
      walkin: '🚶',
      zoho: '📦',
    };
    return icons[source] || '📱';
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setShowDetailView(true);
  };

  // One tap from the list — opens WhatsApp with the tracking message
  // pre-filled, she just taps Send in WhatsApp itself. wa.me links can't
  // send with zero taps (WhatsApp doesn't allow that from a plain link),
  // so this is as close to 1-click as it gets without the paid Business API.
  const handleSendTrackingWhatsApp = (order) => {
    const templates = loadTemplates();
    const template = templates.dispatched?.template || templates.tracking_update?.template;
    if (!template) return;
    const message = fillTemplate(template, order);
    const phone = order.phone?.replace(/[^0-9]/g, '') || '';
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleScanComplete = (scannedOrders) => {
    if (scannedOrders.length > 0) {
      loadOrders();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-gray-600 mt-1">Manage customer orders from enquiry to delivery</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowNewOrderForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
          <button
            onClick={() => setShowQRScanner(true)}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium"
            title="Scan QR for dispatch"
          >
            <Camera className="w-4 h-4" />
            Scan
          </button>
          <button
            onClick={() => setShowTrackingEntry(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
          >
            <Zap className="w-4 h-4" />
            Tracking
          </button>
          <button
            onClick={() => setShowTrackingScanner(true)}
            className="flex items-center gap-2 px-3 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition text-sm font-medium"
            title="Scan the barcode on courier slips to set tracking numbers"
          >
            <Camera className="w-4 h-4" />
            Scan Slips
          </button>
          <button
            onClick={() => setShowCourierDashboard(true)}
            className="flex items-center gap-2 px-3 py-2 bg-fuchsia-100 text-fuchsia-700 rounded-lg hover:bg-fuchsia-200 transition text-sm font-medium"
            title="See all courier-tracked orders in one list — name, date, weight, amount, tracking #, WhatsApp, status"
          >
            <ClipboardList className="w-4 h-4" />
            Courier Dashboard
          </button>
          <button
            onClick={() => setShowBulkWhatsApp(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
            title="Bulk send tracking via WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            Bulk WA
          </button>
          <button
            onClick={() => setShowTrackingImport(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
            title="Import tracking numbers from courier CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Track CSV
          </button>
          <button
            onClick={() => setShowZohoImport(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => setShowBulkLabelPrint(true)}
            className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-medium"
            title="Print labels for orders by date"
          >
            <Printer className="w-4 h-4" />
            Labels
          </button>
          <button
            onClick={() => setShowA4LabelSheet(true)}
            className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm font-medium"
            title="Print 6 labels per A4 sheet — for regular printers, cut and paste onto each box"
          >
            <LayoutGrid className="w-4 h-4" />
            A4 Sheet
          </button>
          <button
            onClick={() => setShowTrackingChecker(!showTrackingChecker)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm font-medium ${showTrackingChecker ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
            title="Check delivery status & send feedback"
          >
            <Truck className="w-4 h-4" />
            Delivery
          </button>
          <button
            onClick={() => setShowDeletePanel(true)}
            className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition text-sm font-medium"
            title="Search for an order and delete it safely"
          >
            <Trash2 className="w-4 h-4" />
            Delete Order
          </button>
        </div>
      </div>

      {/* Tracking Checker Panel */}
      {showTrackingChecker && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-600" />
              Delivery Tracking & Feedback
            </h2>
            <button onClick={() => setShowTrackingChecker(false)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
          </div>
          <TrackingChecker orders={orders} onOrderUpdate={loadOrders} showToast={showToast} />
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={`px-3 py-2 rounded-full whitespace-nowrap text-sm font-medium transition ${
              filterStatus === tab.value
                ? 'bg-teal-600 text-white'
                : `${tab.color} text-gray-700 hover:bg-gray-200`
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order #, customer, address, or tracking #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
        <span className="text-sm text-gray-500 font-medium">Order date:</span>
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); }}
        />
        <span className="ml-auto text-xs text-gray-400">{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} shown</span>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">No orders found</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowNewOrderForm(true)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              Create First Order
            </button>
            <button
              onClick={() => setShowZohoImport(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Import from CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Source</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Label</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Order ID</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  const { stuck, days } = getStuckInfo(order);
                  return (
                    <tr key={order.id} className={`border-b transition ${stuck ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(order.order_date)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{order.customer_name || 'N/A'}</div>
                        {order.phone && <div className="text-xs text-gray-500">{order.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-lg" title={order.order_source}>{getSourceIcon(order.order_source)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">₹{order.total_amount?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                          {stuck && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-600 text-white"
                              title="Sitting in pre-courier status longer than expected (Sunday-no-pickup already accounted for) — may have been missed during printing"
                            >
                              ⚠ Stuck {days}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {order.label_printed_at ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" title={`Printed ${formatDate(order.label_printed_at)}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Printed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Printer className="w-3.5 h-3.5" /> Not printed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-teal-600 cursor-pointer" onClick={() => handleViewOrder(order)}>
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {order.tracking_number && order.phone && (
                            <button
                              onClick={() => handleSendTrackingWhatsApp(order)}
                              className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition"
                              title="Send tracking via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleViewOrder(order)}
                            className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded transition"
                            title="View Order"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Summary bar */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {filterStatus !== 'all' ? ` (${getStatusBadge(filterStatus).label})` : ''}
            </span>
            <span className="font-medium text-gray-900">
              Total: ₹{filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewOrderForm && (
        <NewOrderForm
          onClose={() => {
            setShowNewOrderForm(false);
            loadOrders();
          }}
        />
      )}

      {showDetailView && selectedOrder && (
        <OrderDetailView
          order={selectedOrder}
          onClose={() => {
            setShowDetailView(false);
            setSelectedOrder(null);
          }}
          onUpdate={() => loadOrders()}
        />
      )}

      {showTrackingEntry && (
        <BulkTrackingEntry
          orders={orders.filter(o => o.status === 'collected')}
          onClose={() => {
            setShowTrackingEntry(false);
            loadOrders();
          }}
          onUpdate={() => loadOrders()}
        />
      )}

      {showTrackingScanner && (
        <TrackingScanner
          orders={orders.filter(o => !o.tracking_number && !['dispatched', 'transit', 'delivered', 'cancelled', 'returned'].includes(o.status))}
          onClose={() => setShowTrackingScanner(false)}
          onUpdate={() => loadOrders()}
        />
      )}

      {showCourierDashboard && (
        <CourierDashboard
          orders={orders}
          onClose={() => setShowCourierDashboard(false)}
          onUpdate={() => loadOrders()}
          showToast={showToast}
        />
      )}

      {showQRScanner && (
        <QRScanner
          onClose={() => setShowQRScanner(false)}
          onScanComplete={handleScanComplete}
        />
      )}

      {showZohoImport && (
        <ZohoImport
          onClose={() => setShowZohoImport(false)}
          onImportComplete={() => loadOrders()}
        />
      )}

      {showTrackingImport && (
        <TrackingCSVImport
          orders={orders}
          onClose={() => setShowTrackingImport(false)}
          onImportComplete={() => loadOrders()}
          showToast={showToast}
        />
      )}

      {showBulkWhatsApp && (
        <BulkWhatsAppSend
          orders={orders}
          onClose={() => setShowBulkWhatsApp(false)}
        />
      )}

      {showBulkLabelPrint && (
        <BulkLabelPrint
          orders={orders}
          onClose={() => setShowBulkLabelPrint(false)}
          onPrinted={() => loadOrders()}
          showToast={showToast}
        />
      )}

      {showA4LabelSheet && (
        <A4LabelSheet
          orders={orders}
          onClose={() => setShowA4LabelSheet(false)}
          onPrinted={() => loadOrders()}
          showToast={showToast}
        />
      )}

      {showDeletePanel && (
        <DeleteOrderPanel
          orders={orders}
          onClose={() => setShowDeletePanel(false)}
          onDeleted={() => loadOrders()}
          showToast={showToast}
        />
      )}
    </div>
  );
}
