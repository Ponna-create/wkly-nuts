import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Trash2, Zap, Camera, FileSpreadsheet, MessageCircle, Truck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import NewOrderForm from '../components/sales/NewOrderForm';
import OrderDetailView from '../components/sales/OrderDetailView';
import BulkTrackingEntry from '../components/sales/BulkTrackingEntry';
import BulkWhatsAppSend from '../components/sales/BulkWhatsAppSend';
import QRScanner from '../components/sales/QRScanner';
import ZohoImport from '../components/sales/ZohoImport';
import TrackingCSVImport from '../components/sales/TrackingCSVImport';
import TrackingChecker from '../components/sales/TrackingChecker';

export default function SalesOrders() {
  const { state, dispatch, showToast } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [showTrackingEntry, setShowTrackingEntry] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showZohoImport, setShowZohoImport] = useState(false);
  const [showTrackingImport, setShowTrackingImport] = useState(false);
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false);
  const [showTrackingChecker, setShowTrackingChecker] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Status tabs
  const statusTabs = [
    { label: 'All', value: 'all', color: 'bg-gray-100', count: orders.length },
    { label: 'Follow-up', value: 'follow_up', color: 'bg-blue-100', count: orders.filter(o => o.status === 'follow_up').length },
    { label: 'Packing', value: 'packing', color: 'bg-yellow-100', count: orders.filter(o => o.status === 'packing').length },
    { label: 'Packed', value: 'packed', color: 'bg-orange-100', count: orders.filter(o => o.status === 'packed').length },
    { label: 'Dispatched', value: 'dispatched', color: 'bg-purple-100', count: orders.filter(o => o.status === 'dispatched').length },
    { label: 'In Transit', value: 'in_transit', color: 'bg-indigo-100', count: orders.filter(o => o.status === 'in_transit').length },
    { label: 'Delivered', value: 'delivered', color: 'bg-green-100', count: orders.filter(o => o.status === 'delivered').length },
  ];

  useEffect(() => {
    loadOrders();
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
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    const badges = {
      follow_up: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Follow-up' },
      awaiting_payment: { bg: 'bg-red-100', text: 'text-red-800', label: 'Awaiting Payment' },
      packing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Packing' },
      packed: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Packed' },
      dispatched: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Dispatched' },
      in_transit: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'In Transit' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
      completed: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Completed' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
      returned: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Returned' },
    };
    return badges[status] || badges.packing;
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

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    const { error } = await dbService.deleteSalesOrder(orderId);
    if (error) {
      showToast('Error deleting order', 'error');
    } else {
      showToast('Order deleted successfully', 'success');
      loadOrders();
    }
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
            onClick={() => setShowTrackingChecker(!showTrackingChecker)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-sm font-medium ${showTrackingChecker ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
            title="Check delivery status & send feedback"
          >
            <Truck className="w-4 h-4" />
            Delivery
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
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Source</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  return (
                    <tr key={order.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm font-medium text-teal-600 cursor-pointer" onClick={() => handleViewOrder(order)}>
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{order.customer_name || 'N/A'}</div>
                        {order.phone && <div className="text-xs text-gray-500">{order.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-lg" title={order.order_source}>{getSourceIcon(order.order_source)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">₹{order.total_amount?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{order.order_date}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleViewOrder(order)}
                            className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded transition"
                            title="View Order"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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
          orders={orders.filter(o => o.status === 'dispatched')}
          onClose={() => {
            setShowTrackingEntry(false);
            loadOrders();
          }}
          onUpdate={() => loadOrders()}
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
    </div>
  );
}
