import React, { useState, useEffect } from 'react';
import { Truck, RefreshCw, Clock, CheckCircle, AlertCircle, ExternalLink, MessageCircle } from 'lucide-react';
import { dbService } from '../../services/supabase';

const ST_COURIER_URL = 'https://stcourier.com/track/shipment';

// Tracking status categories
const DELIVERY_KEYWORDS = ['delivered', 'delivery completed', 'received by', 'pod uploaded'];
const IN_TRANSIT_KEYWORDS = ['in transit', 'out for delivery', 'dispatched', 'arrived at', 'departed'];

function guessTrackingStatus(trackingInfo) {
  if (!trackingInfo) return 'unknown';
  const lower = (typeof trackingInfo === 'string' ? trackingInfo : '').toLowerCase();
  if (DELIVERY_KEYWORDS.some(k => lower.includes(k))) return 'delivered';
  if (IN_TRANSIT_KEYWORDS.some(k => lower.includes(k))) return 'in_transit';
  return 'unknown';
}

export default function TrackingChecker({ orders, onOrderUpdate, showToast }) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState([]);
  const [lastChecked, setLastChecked] = useState(null);
  const [autoMode, setAutoMode] = useState(false);

  // Orders that are dispatched/in_transit with tracking numbers
  const trackableOrders = (orders || []).filter(o =>
    ['dispatched', 'in_transit'].includes(o.status) && o.tracking_number
  );

  // Orders that were delivered recently (within last 5 days) - for WhatsApp feedback
  const recentlyDelivered = (orders || []).filter(o => {
    if (o.status !== 'delivered') return false;
    if (!o.actual_delivery_date) return false;
    const deliveryDate = new Date(o.actual_delivery_date);
    const daysSince = Math.floor((Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= 2 && daysSince <= 5 && !o.feedback_sent;
  });

  const handleCheckAll = async () => {
    if (trackableOrders.length === 0) {
      showToast('No orders to check - all orders are either not dispatched or missing tracking numbers', 'error');
      return;
    }

    setChecking(true);
    const checkResults = [];

    for (const order of trackableOrders) {
      // We can't actually scrape ST Courier from frontend due CORS
      // But we create a tracking link and provide a manual check mechanism
      checkResults.push({
        order,
        trackingUrl: `${ST_COURIER_URL}?tracking=${order.tracking_number}`,
        suggestedStatus: order.status, // Will be updated by user
      });
    }

    setResults(checkResults);
    setLastChecked(new Date());
    setChecking(false);
    showToast(`Loaded ${checkResults.length} orders to check`, 'success');
  };

  const handleMarkDelivered = async (order) => {
    const updated = {
      ...order,
      status: 'delivered',
      actual_delivery_date: new Date().toISOString().split('T')[0],
    };
    const { error } = await dbService.updateSalesOrder(updated);
    if (error) {
      showToast('Error updating order', 'error');
      return;
    }

    // Update local results
    setResults(prev => prev.filter(r => r.order.id !== order.id));
    showToast(`${order.order_number} marked as Delivered!`, 'success');
    if (onOrderUpdate) onOrderUpdate();
  };

  const handleSendFeedbackWhatsApp = (order) => {
    const phone = order.phone?.replace(/[^0-9]/g, '') || '';
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const message = `Hi ${order.customer_name}! ✅\n\nYour order *${order.order_number}* was delivered recently! We hope you're enjoying your WKLY Nuts! 🥜\n\nWe'd love to hear your feedback - what did you think?\n\n⭐ How would you rate your experience? (1-5)\n\nFor reorders, just message us here!\n\nWKLY Nuts Team`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    // Mark feedback as sent
    dbService.updateSalesOrder({ ...order, feedback_sent: true });
    showToast('WhatsApp feedback opened - mark as sent', 'success');
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Truck className="w-4 h-4" />
            <span className="text-xs font-medium">To Check</span>
          </div>
          <p className="text-xl font-bold text-purple-900">{trackableOrders.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Recently Delivered</span>
          </div>
          <p className="text-xl font-bold text-green-900">{recentlyDelivered.length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Pending Feedback</span>
          </div>
          <p className="text-xl font-bold text-amber-900">{recentlyDelivered.length}</p>
        </div>
      </div>

      {/* Check Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCheckAll}
          disabled={checking || trackableOrders.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Check All Tracking'}
        </button>
        {lastChecked && (
          <span className="text-xs text-gray-500">
            Last checked: {lastChecked.toLocaleTimeString('en-IN')}
          </span>
        )}
      </div>

      {/* Trackable Orders List */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 text-sm">Orders with Tracking ({results.length})</h3>
          {results.map(({ order, trackingUrl }) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">{order.order_number}</span>
                    <span className="text-xs text-gray-500">{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{order.tracking_number}</code>
                    <span className="text-xs text-gray-400">{order.courier_name || 'ST Courier'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <ExternalLink className="w-3 h-3" /> Track
                  </a>
                  <button
                    onClick={() => handleMarkDelivered(order)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <CheckCircle className="w-3 h-3" /> Delivered
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recently Delivered - Pending Feedback */}
      {recentlyDelivered.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-600" />
            Send Feedback Request (Delivered 2-5 days ago)
          </h3>
          {recentlyDelivered.map(order => (
            <div key={order.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-sm">{order.order_number}</span>
                  <span className="text-xs text-gray-500 ml-2">{order.customer_name}</span>
                  <span className="text-xs text-green-600 ml-2">Delivered: {order.actual_delivery_date}</span>
                </div>
                <button
                  onClick={() => handleSendFeedbackWhatsApp(order)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700"
                >
                  <MessageCircle className="w-3 h-3" /> Send Feedback WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty States */}
      {trackableOrders.length === 0 && recentlyDelivered.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Truck className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">No orders to track. Dispatch orders first!</p>
        </div>
      )}
    </div>
  );
}
