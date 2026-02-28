import React, { useState } from 'react';
import { X, Copy, Check, Printer, MessageCircle, Package, Truck, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';
import LabelPrinter from './LabelPrinter';
import WhatsAppSender from './WhatsAppSender';

export default function OrderDetailView({ order, onClose, onUpdate }) {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(order);

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
    const updateData = {
      ...currentOrder,
      status: newStatus,
    };

    // Auto-set dates based on status
    if (newStatus === 'dispatched' && !currentOrder.dispatch_date) {
      updateData.dispatch_date = new Date().toISOString().split('T')[0];
    }
    if (newStatus === 'delivered' && !currentOrder.actual_delivery_date) {
      updateData.actual_delivery_date = new Date().toISOString().split('T')[0];
    }

    const { error } = await dbService.updateSalesOrder(updateData);

    if (error) {
      showToast('Error updating status', 'error');
    } else {
      showToast(`Status updated to ${getStatusBadge(newStatus).label}`, 'success');
      setCurrentOrder(prev => ({ ...prev, status: newStatus }));
      onUpdate();
    }
    setLoading(false);
  };

  const handlePrintAndPack = async () => {
    setShowLabelPrinter(true);
    // Also update status to packed
    if (currentOrder.status === 'packing') {
      await handleStatusChange('packed');
    }
  };

  const badge = getStatusBadge(currentOrder.status);

  // Status timeline
  const statusSteps = [
    { key: 'follow_up', label: 'Follow-up', icon: MessageCircle },
    { key: 'packing', label: 'Packing', icon: Package },
    { key: 'packed', label: 'Packed', icon: Package },
    { key: 'dispatched', label: 'Dispatched', icon: Truck },
    { key: 'in_transit', label: 'In Transit', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  const currentStepIndex = statusSteps.findIndex(s => s.key === currentOrder.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{currentOrder.order_number}</h2>
            <p className="text-sm text-gray-600 mt-1">{currentOrder.order_date}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Timeline */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {statusSteps.map((step, idx) => {
              const isActive = idx <= currentStepIndex;
              const isCurrent = step.key === currentOrder.status;
              const Icon = step.icon;
              return (
                <React.Fragment key={step.key}>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    isCurrent ? 'bg-teal-600 text-white' :
                    isActive ? 'bg-teal-100 text-teal-800' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="w-3 h-3" />
                    {step.label}
                  </div>
                  {idx < statusSteps.length - 1 && (
                    <div className={`w-4 h-0.5 flex-shrink-0 ${isActive ? 'bg-teal-400' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Status + Change */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <select
              value={currentOrder.status}
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

          {/* Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Customer</p>
              <p className="text-lg font-bold text-gray-900">{currentOrder.customer_name}</p>
              {currentOrder.phone && <p className="text-sm text-gray-600">{currentOrder.phone}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Source</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{currentOrder.order_source}</p>
            </div>
          </div>

          {currentOrder.shipping_address && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Shipping Address</p>
              <p className="text-sm text-gray-700 mt-1">{currentOrder.shipping_address}</p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Items</h3>
            {currentOrder.items && currentOrder.items.length > 0 ? (
              <div className="space-y-2">
                {currentOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.sku_name || item.skuName}</p>
                      <p className="text-sm text-gray-600 capitalize">{item.pack_type || item.packType} Pack</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">x{item.quantity}</p>
                      <p className="text-sm text-gray-600">₹{item.total || (item.quantity * (item.unit_price || item.unitPrice || 0))}</p>
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
              <span className="font-medium">₹{currentOrder.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">GST ({currentOrder.gst_rate || 5}%):</span>
              <span className="font-medium">₹{currentOrder.gst_amount?.toFixed(2) || '0.00'}</span>
            </div>
            {currentOrder.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium text-red-600">-₹{currentOrder.discount_amount?.toFixed(2)}</span>
              </div>
            )}
            {currentOrder.shipping_charge > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-medium">₹{currentOrder.shipping_charge?.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
              <span>Total:</span>
              <span className="text-teal-600">₹{currentOrder.total_amount?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Payment</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Method</p>
                <p className="text-gray-900 capitalize">{currentOrder.payment_method || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
                <p className={`capitalize font-medium ${
                  currentOrder.payment_status === 'received' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {currentOrder.payment_status || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Paid</p>
                <p className="text-gray-900">₹{currentOrder.amount_paid?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
            {currentOrder.transaction_id && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Transaction ID</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{currentOrder.transaction_id}</code>
                  <button
                    onClick={() => handleCopyToClipboard(currentOrder.transaction_id, 'txn')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {copiedField === 'txn' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Shipping */}
          {(currentOrder.tracking_number || currentOrder.courier_name || currentOrder.dispatch_date) && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-900">Shipping</h3>
              <div className="grid grid-cols-2 gap-4">
                {currentOrder.courier_name && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Courier</p>
                    <p className="text-gray-900">{currentOrder.courier_name}</p>
                  </div>
                )}
                {currentOrder.dispatch_date && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Dispatch Date</p>
                    <p className="text-gray-900">{currentOrder.dispatch_date}</p>
                  </div>
                )}
              </div>
              {currentOrder.tracking_number && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Tracking Number</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{currentOrder.tracking_number}</code>
                    <button
                      onClick={() => handleCopyToClipboard(currentOrder.tracking_number, 'tracking')}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {copiedField === 'tracking' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Follow-up Notes */}
          {currentOrder.follow_up_notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Follow-up Notes</p>
              <p className="text-gray-700 mt-1 text-sm">{currentOrder.follow_up_notes}</p>
            </div>
          )}

          {/* Notes */}
          {currentOrder.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Notes</p>
              <p className="text-gray-700 mt-1 text-sm">{currentOrder.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-6">
            <button
              onClick={() => setShowWhatsApp(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={handlePrintAndPack}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm"
            >
              <Printer className="w-4 h-4" />
              Print Label
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modals */}
      {showLabelPrinter && (
        <LabelPrinter
          order={currentOrder}
          onClose={() => setShowLabelPrinter(false)}
        />
      )}

      {showWhatsApp && (
        <WhatsAppSender
          order={currentOrder}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </div>
  );
}
