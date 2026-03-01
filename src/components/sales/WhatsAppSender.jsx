import React, { useState, useEffect } from 'react';
import { X, Copy, ExternalLink, Check, MessageCircle, Settings, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ST_COURIER_TRACKING_URL = 'https://stcourier.com/track/shipment';

// Default templates - user can customize these
const DEFAULT_TEMPLATES = {
  order_confirmation: {
    label: 'Order Confirmation',
    template: `Hi {customer_name}! 🥜

Thank you for your order!

*Order: {order_number}*
{items}

*Total: ₹{total_amount}*

We'll notify you once your order is packed and dispatched.

Thanks,
WKLY Nuts Team`,
  },
  dispatched: {
    label: 'Dispatched + Tracking',
    template: `Hi {customer_name}, your package is on its way! 📦
Courier: ST Courier
Tracking ID: {tracking_number}
Destination: {city} - {pincode}
Track here: ${ST_COURIER_TRACKING_URL}`,
  },
  tracking_update: {
    label: 'Tracking Update',
    template: `Hi {customer_name}! 🚚

Here's your tracking update for order *{order_number}*:

Courier: ST Courier
Tracking ID: {tracking_number}
Track here: ${ST_COURIER_TRACKING_URL}

WKLY Nuts Team`,
  },
  delivered: {
    label: 'Delivery Confirmation',
    template: `Hi {customer_name}! ✅

Your order *{order_number}* has been delivered!

We hope you enjoy your WKLY Nuts! If you have a moment, we'd love to hear your feedback. 😊

For reorders, just message us here!

WKLY Nuts Team 🥜`,
  },
  follow_up: {
    label: 'Follow-up Reminder',
    template: `Hi {customer_name}! 👋

Just checking in about your interest in WKLY Nuts!

We have some great options:
🥜 Day Pack - 7 sachets for the week
🌙 Soak Overnight - Premium soaking nuts
🌱 Seed Cycle - Hormone balancing seeds

Would you like to place an order? We'd be happy to help!

WKLY Nuts Team`,
  },
};

// Load saved templates from localStorage
const loadTemplates = () => {
  try {
    const saved = localStorage.getItem('wklyNutsWhatsAppTemplates');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new templates added in updates
      return { ...DEFAULT_TEMPLATES, ...parsed };
    }
  } catch (e) {
    console.error('Error loading templates:', e);
  }
  return DEFAULT_TEMPLATES;
};

const saveTemplates = (templates) => {
  try {
    localStorage.setItem('wklyNutsWhatsAppTemplates', JSON.stringify(templates));
  } catch (e) {
    console.error('Error saving templates:', e);
  }
};

// Replace variables in template with order data
const fillTemplate = (template, order) => {
  const items = (order.items || [])
    .map(i => `  ${i.sku_name || i.skuName} (${i.pack_type || i.packType}) x${i.quantity}`)
    .join('\n');

  // Parse city and pincode from shipping address
  const address = order.shipping_address || '';
  const pincodeMatch = address.match(/(\d{6})/);
  const pincode = pincodeMatch ? pincodeMatch[1] : '';
  // Try to get city - last part before pincode or after last comma
  let city = '';
  if (order.shipping_city) {
    city = order.shipping_city;
  } else {
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Get the part before pincode, or second-to-last
      city = parts[parts.length - 2]?.replace(/\d{6}/, '').trim() || parts[0];
    } else {
      city = address.replace(/\d{6}/, '').trim();
    }
  }

  return template
    .replace(/{customer_name}/g, order.customer_name || 'Customer')
    .replace(/{order_number}/g, order.order_number || '')
    .replace(/{total_amount}/g, order.total_amount?.toFixed(2) || '0.00')
    .replace(/{tracking_number}/g, order.tracking_number || 'N/A')
    .replace(/{courier_name}/g, order.courier_name || 'ST Courier')
    .replace(/{city}/g, city)
    .replace(/{pincode}/g, pincode)
    .replace(/{phone}/g, order.phone || '')
    .replace(/{items}/g, items)
    .replace(/{tracking_url}/g, ST_COURIER_TRACKING_URL);
};

export default function WhatsAppSender({ order, onClose }) {
  const { showToast } = useApp();
  const [templates, setTemplates] = useState(loadTemplates());
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editTemplateText, setEditTemplateText] = useState('');

  const defaultKey =
    order.status === 'follow_up' ? 'follow_up' :
    order.status === 'in_transit' || order.status === 'dispatched' ? 'dispatched' :
    order.status === 'delivered' ? 'delivered' :
    'order_confirmation';

  const [selectedTemplate, setSelectedTemplate] = useState(defaultKey);
  const [message, setMessage] = useState(fillTemplate(templates[defaultKey].template, order));
  const [copied, setCopied] = useState(false);

  const handleTemplateChange = (templateKey) => {
    setSelectedTemplate(templateKey);
    setMessage(fillTemplate(templates[templateKey].template, order));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    showToast('Message copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const phone = order.phone?.replace(/[^0-9]/g, '') || '';
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const startEditTemplate = (key) => {
    setEditingTemplate(key);
    setEditTemplateText(templates[key].template);
    setShowTemplateEditor(true);
  };

  const saveTemplate = () => {
    const updated = {
      ...templates,
      [editingTemplate]: {
        ...templates[editingTemplate],
        template: editTemplateText,
      },
    };
    setTemplates(updated);
    saveTemplates(updated);
    // Refresh current message if editing current template
    if (editingTemplate === selectedTemplate) {
      setMessage(fillTemplate(editTemplateText, order));
    }
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    showToast('Template saved!', 'success');
  };

  const resetTemplate = () => {
    if (editingTemplate && DEFAULT_TEMPLATES[editingTemplate]) {
      setEditTemplateText(DEFAULT_TEMPLATES[editingTemplate].template);
    }
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
            {order.tracking_number && (
              <p className="text-xs text-purple-600 mt-1">Tracking: {order.tracking_number}</p>
            )}
          </div>

          {/* Template Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">Message Template</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(templates).map(([key, template]) => (
                <div key={key} className="flex items-center gap-1">
                  <button
                    onClick={() => handleTemplateChange(key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      selectedTemplate === key
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {template.label}
                  </button>
                  <button
                    onClick={() => startEditTemplate(key)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Edit template"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Available Variables Info */}
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            Variables: {'{customer_name}'}, {'{order_number}'}, {'{total_amount}'}, {'{tracking_number}'}, {'{city}'}, {'{pincode}'}, {'{items}'}, {'{tracking_url}'}
          </div>

          {/* Template Editor */}
          {showTemplateEditor && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-900">
                  Edit: {templates[editingTemplate]?.label}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={resetTemplate}
                    className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-100 rounded"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
              <textarea
                value={editTemplateText}
                onChange={(e) => setEditTemplateText(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={saveTemplate}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  <Save className="w-3 h-3" />
                  Save Template
                </button>
                <button
                  onClick={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}
                  className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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

// Export for bulk use
export { fillTemplate, loadTemplates, ST_COURIER_TRACKING_URL };
