import React, { useState } from 'react';
import { X, Download, Eye, Copy, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';

export default function OrderDetailView({ order, onClose, onUpdate }) {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

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
    };
    return badges[status] || badges.packing;
  };

  const handleCopyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStatusChange = async (newStatus) => {
    setLoading(true);
    const { error } = await dbService.updateSalesOrder({
      ...order,
      status: newStatus,
    });

    if (error) {
      showToast('Error updating status', 'error');
    } else {
      showToast('Status updated successfully', 'success');
      onUpdate();
    }
    setLoading(false);
  };

  const badge = getStatusBadge(order.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{order.order_number}</h2>
            <p className="text-sm text-gray-600 mt-1">{order.order_date}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
              <select
                value={order.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={loading}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="follow_up">Follow-up</option>
                <option value="awaiting_payment">Awaiting Payment</option>
                <option value="packing">Packing</option>
                <option value="packed">Packed</option>
                <option value="dispatched">Dispatched</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Customer Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Customer</p>
              <p className="text-lg font-bold text-gray-900">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Source</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{order.order_source}</p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Items</h3>
            {order.items && order.items.length > 0 ? (
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.sku_name || item.skuName}</p>
                      <p className="text-sm text-gray-600">{item.pack_type || item.packType}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{item.quantity}</p>
                      <p className="text-sm text-gray-600">₹{item.total || (item.quantity * item.unit_price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No items</p>
            )}
          </div>

          {/* Financials */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">₹{order.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">GST ({order.gst_rate}%):</span>
              <span className="font-medium">₹{order.gst_amount?.toFixed(2) || '0.00'}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium">-₹{order.discount_amount?.toFixed(2)}</span>
              </div>
            )}
            {order.shipping_charge > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-medium">₹{order.shipping_charge?.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
              <span>Total:</span>
              <span className="text-teal-600">₹{order.total_amount?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Payment</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Method</p>
                <p className="text-gray-900 capitalize">{order.payment_method || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
                <p className="text-gray-900 capitalize">{order.payment_status || 'N/A'}</p>
              </div>
            </div>
            {order.transaction_id && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Transaction ID</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{order.transaction_id}</code>
                  <button
                    onClick={() => handleCopyToClipboard(order.transaction_id, 'txn')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {copiedField === 'txn' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Shipping */}
          {order.status !== 'packing' && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-900">Shipping</h3>
              {order.tracking_number && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Tracking Number</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{order.tracking_number}</code>
                    <button
                      onClick={() => handleCopyToClipboard(order.tracking_number, 'tracking')}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {copiedField === 'tracking' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              {order.courier_name && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Courier</p>
                  <p className="text-gray-900">{order.courier_name}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Notes</p>
              <p className="text-gray-700 mt-1">{order.notes}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end border-t border-gray-200 pt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              Close
            </button>
            <button
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
