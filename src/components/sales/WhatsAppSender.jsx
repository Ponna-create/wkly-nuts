import React, { useState } from 'react';
import { X, Copy, ExternalLink, Check, MessageCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const MESSAGE_TEMPLATES = {
  order_confirmation: {
    label: 'Order Confirmation',
    generate: (order) => {
      const items = (order.items || [])
        .map(i => `  ${i.sku_name || i.skuName} (${i.pack_type || i.packType}) x${i.quantity}`)
        .join('\n');
      return `Hi ${order.customer_name}! 🥜\n\nThank you for your order!\n\n*Order: ${order.order_number}*\n${items}\n\n*Total: ₹${order.total_amount?.toFixed(2)}*\n\nWe'll notify you once your order is packed and dispatched.\n\nThanks,\nWKLY Nuts Team`;
    },
  },
  dispatched: {
    label: 'Order Dispatched',
    generate: (order) => {
      const trackingInfo = order.tracking_number
        ? `\n\n*Tracking Number:* ${order.tracking_number}\n*Courier:* ${order.courier_name || 'ST Courier'}`
        : '';
      return `Hi ${order.customer_name}! 📦\n\nGreat news! Your order *${order.order_number}* has been dispatched!${trackingInfo}\n\nEstimated delivery: 3-5 business days\n\nThank you for choosing WKLY Nuts! 🥜`;
    },
  },
  tracking_update: {
    label: 'Tracking Update',
    generate: (order) => {
      return `Hi ${order.customer_name}! 🚚\n\nHere's your tracking update for order *${order.order_number}*:\n\n*Tracking Number:* ${order.tracking_number || 'N/A'}\n*Courier:* ${order.courier_name || 'ST Courier'}\n\nYou can track your order status anytime.\n\nWKLY Nuts Team`;
    },
  },
  delivered: {
    label: 'Delivery Confirmation',
    generate: (order) => {
      return `Hi ${order.customer_name}! ✅\n\nYour order *${order.order_number}* has been delivered!\n\nWe hope you enjoy your WKLY Nuts! If you have a moment, we'd love to hear your feedback. 😊\n\nFor reorders, just message us here!\n\nWKLY Nuts Team 🥜`;
    },
  },
  follow_up: {
    label: 'Follow-up Reminder',
    generate: (order) => {
      return `Hi ${order.customer_name}! 👋\n\nJust checking in about your interest in WKLY Nuts!\n\nWe have some great options:\n🥜 Day Pack - 7 sachets for the week\n🌙 Soak Overnight - Premium soaking nuts\n🌱 Seed Cycle - Hormone balancing seeds\n\nWould you like to place an order? We'd be happy to help!\n\nWKLY Nuts Team`;
    },
  },
};

export default function WhatsAppSender({ order, onClose }) {
  const { showToast } = useApp();
  const [selectedTemplate, setSelectedTemplate] = useState(
    order.status === 'follow_up' ? 'follow_up' :
    order.status === 'in_transit' || order.status === 'dispatched' ? 'dispatched' :
    order.status === 'delivered' ? 'delivered' :
    'order_confirmation'
  );
  const [message, setMessage] = useState(
    MESSAGE_TEMPLATES[
      order.status === 'follow_up' ? 'follow_up' :
      order.status === 'in_transit' || order.status === 'dispatched' ? 'dispatched' :
      order.status === 'delivered' ? 'delivered' :
      'order_confirmation'
    ].generate(order)
  );
  const [copied, setCopied] = useState(false);

  const handleTemplateChange = (templateKey) => {
    setSelectedTemplate(templateKey);
    setMessage(MESSAGE_TEMPLATES[templateKey].generate(order));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    showToast('Message copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const phone = order.phone?.replace(/[^0-9]/g, '') || '';
    // Add India country code if not present
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">WhatsApp Message</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Order Info */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">{order.order_number}</p>
            <p className="text-sm text-gray-600">{order.customer_name} {order.phone ? `• ${order.phone}` : ''}</p>
          </div>

          {/* Template Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Message Template</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MESSAGE_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => handleTemplateChange(key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    selectedTemplate === key
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Editor */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">{message.length} characters</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Message
                </>
              )}
            </button>
            <button
              onClick={handleOpenWhatsApp}
              disabled={!order.phone}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ExternalLink className="w-4 h-4" />
              Open WhatsApp
            </button>
          </div>
          {!order.phone && (
            <p className="text-xs text-red-500 text-center">No phone number available for this customer</p>
          )}
        </div>
      </div>
    </div>
  );
}
