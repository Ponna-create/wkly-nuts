import React, { useState, useMemo } from 'react';
import { X, MessageCircle, RefreshCw, Search } from 'lucide-react';
import { dbService } from '../../services/supabase';
import { fillTemplate, loadTemplates } from './WhatsAppSender';
import { fetchCourierStatus } from '../../utils/courierStatusApi';

// One row per courier-tracked order — everything the slip scan (Scan Slips)
// already extracted and matched, laid out as a list instead of buried in
// the Sales Orders table. The Status column is a stand-in until a real
// courier tracking API is wired up (see utils/courierStatusApi.js) — for
// now it shows the pipeline status she's already set, with quick buttons
// to update it herself.
export default function CourierDashboard({ orders, onClose, onUpdate, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [checkingId, setCheckingId] = useState(null);

  const trackedOrders = useMemo(() => {
    const list = (orders || []).filter(o => o.tracking_number);
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter(o =>
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.tracking_number || '').toLowerCase().includes(q)
    );
  }, [orders, searchTerm]);

  const statusBadge = (status) => {
    const map = {
      dispatched: 'bg-purple-100 text-purple-800',
      transit: 'bg-indigo-100 text-indigo-800',
      collected: 'bg-pink-100 text-pink-800',
      delivered: 'bg-green-100 text-green-800',
    };
    const label = { dispatched: 'Dispatched', transit: 'In Transit', collected: 'Collected', delivered: 'Delivered' }[status] || status;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>{label}</span>;
  };

  const handleSendWhatsApp = (order) => {
    const templates = loadTemplates();
    const template = templates.dispatched?.template || templates.tracking_update?.template;
    if (!template) return;
    const message = fillTemplate(template, order);
    const phone = order.phone?.replace(/[^0-9]/g, '') || '';
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleCheckStatus = async (order) => {
    setCheckingId(order.id);
    const result = await fetchCourierStatus(order.tracking_number, order.courier_name);
    setCheckingId(null);
    showToast(result.status || result.note, result.status ? 'success' : 'info');
  };

  const handleQuickStatus = async (order, status) => {
    const extra = status === 'delivered' ? { actualDeliveryDate: new Date().toISOString().split('T')[0] } : {};
    const { error } = await dbService.updateSalesOrder({ id: order.id, status, ...extra });
    if (error) {
      showToast('Error updating status', 'error');
      return;
    }
    showToast(`${order.order_number} → ${status}`, 'success');
    onUpdate();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Courier Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1">{trackedOrders.length} tracked order{trackedOrders.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer, order #, or tracking #..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {trackedOrders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No courier-tracked orders yet — scan slips first.</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Order ID</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Courier Date</th>
                    <th className="px-3 py-2 text-left">Weight</th>
                    <th className="px-3 py-2 text-left">Shipping Amt</th>
                    <th className="px-3 py-2 text-left">State</th>
                    <th className="px-3 py-2 text-left">Pincode</th>
                    <th className="px-3 py-2 text-left">Tracking #</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trackedOrders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{o.order_number}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.customer_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.courier_slip_date || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.shipping_weight != null ? `${o.shipping_weight} kg` : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.courier_amount != null ? `₹${o.courier_amount}` : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.shipping_state || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.shipping_pincode || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{o.tracking_number}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{statusBadge(o.status)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSendWhatsApp(o)}
                            title="Send tracking on WhatsApp"
                            className="p-1.5 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCheckStatus(o)}
                            disabled={checkingId === o.id}
                            title="Check live courier status (needs API key)"
                            className="p-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${checkingId === o.id ? 'animate-spin' : ''}`} />
                          </button>
                          {o.status !== 'delivered' && (
                            <button
                              onClick={() => handleQuickStatus(o, o.status === 'transit' ? 'delivered' : 'transit')}
                              className="px-2 py-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100 whitespace-nowrap"
                            >
                              {o.status === 'transit' ? 'Mark Delivered' : 'Mark In Transit'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
