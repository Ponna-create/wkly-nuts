import React, { useState } from 'react';
import { X, MessageCircle, ExternalLink, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fillTemplate, loadTemplates, ST_COURIER_TRACKING_URL } from './WhatsAppSender';

export default function BulkWhatsAppSend({ orders, onClose }) {
  const { showToast } = useApp();
  const templates = loadTemplates();
  const [sentOrders, setSentOrders] = useState({});
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Filter orders that have tracking numbers and phone numbers
  const eligibleOrders = orders.filter(
    o => o.tracking_number && o.phone &&
    (o.status === 'dispatched' || o.status === 'in_transit')
  );

  const handleSendWhatsApp = (order) => {
    const template = templates.dispatched?.template || templates.tracking_update?.template;
    if (!template) return;

    const message = fillTemplate(template, order);
    const phone = order.phone?.replace(/[^0-9]/g, '') || '';
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');

    setSentOrders(prev => ({ ...prev, [order.id]: true }));
  };

  const sentCount = Object.keys(sentOrders).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Bulk Tracking Messages</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Stats */}
          <div className="flex gap-4">
            <div className="flex-1 p-3 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-700">{eligibleOrders.length}</p>
              <p className="text-xs text-green-600">Ready to Send</p>
            </div>
            <div className="flex-1 p-3 bg-blue-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-700">{sentCount}</p>
              <p className="text-xs text-blue-600">Sent</p>
            </div>
            <div className="flex-1 p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-700">
                {orders.filter(o => (o.status === 'dispatched' || o.status === 'in_transit') && (!o.tracking_number || !o.phone)).length}
              </p>
              <p className="text-xs text-gray-600">Missing Info</p>
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            Each click opens WhatsApp with the tracking message pre-filled.
            Messages use your "Dispatched + Tracking" template.
            Edit templates from the individual WhatsApp sender.
          </div>

          {/* Orders List */}
          {eligibleOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-medium">No orders ready for tracking messages</p>
              <p className="text-sm mt-1">Orders need a tracking number and phone number</p>
            </div>
          ) : (
            <div className="space-y-2">
              {eligibleOrders.map((order) => {
                const isSent = sentOrders[order.id];
                const isExpanded = expandedOrder === order.id;
                const message = fillTemplate(templates.dispatched?.template || '', order);

                return (
                  <div
                    key={order.id}
                    className={`border rounded-lg transition ${
                      isSent ? 'border-green-200 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 text-sm">{order.customer_name}</p>
                          {isSent && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {order.order_number} • {order.tracking_number} • {order.phone}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                          title="Preview message"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleSendWhatsApp(order)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            isSent
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {isSent ? 'Resend' : 'Send'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        <pre className="text-xs text-gray-600 bg-white p-3 rounded border border-gray-200 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                          {message}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
