import React, { useState, useEffect } from 'react';
import { Truck, RefreshCw, CheckCircle, ExternalLink, MessageCircle, Zap } from 'lucide-react';
import { dbService } from '../../services/supabase';
import { formatDate } from '../../utils/dateFormat';

const todayISO = () => new Date().toISOString().split('T')[0];

// ST Courier's tracking page can't be pre-filled from outside their site —
// their form does an AJAX call first (which just returns raw JSON) and then
// a second page load that reads the result back out of a server-side
// session, so a plain cross-site form POST only ever shows the JSON, not
// the actual results. Simplest thing that's guaranteed correct: copy the
// AWB to the clipboard and open their page — she pastes it in herself,
// same as always, just without having to retype the number by hand.
const openTrackingPage = (awb) => {
  navigator.clipboard?.writeText(awb).catch(() => {});
  window.open('https://stcourier.com/track/shipment', '_blank');
};

export default function TrackingChecker({ orders, onOrderUpdate, showToast }) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState([]);
  const [lastChecked, setLastChecked] = useState(null);
  const [autoMode, setAutoMode] = useState(false);

  // Auto-check state: a manual, visible trigger — not silent, not automatic
  // on page load. Runs once, disables itself for the rest of the day (the
  // "already ran today" state persists server-side via app_settings, so it
  // stays disabled even across devices/reloads, not just this browser tab).
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoProgress, setAutoProgress] = useState(null); // { current, total, label }
  const [autoResults, setAutoResults] = useState([]); // [{ order, result?, error? }]
  const [autoLastRunDate, setAutoLastRunDate] = useState(null);
  const [autoLastRunAt, setAutoLastRunAt] = useState(null);

  useEffect(() => {
    dbService.getAppSetting('st_courier_auto_check').then(({ data }) => {
      if (data?.date) setAutoLastRunDate(data.date);
      if (data?.at) setAutoLastRunAt(data.at);
    });
  }, []);

  const autoAlreadyRanToday = autoLastRunDate === todayISO();

  // Orders that are dispatched/collected/transit with tracking numbers —
  // 'transit' is the actual pipeline status (OrderDetailView.jsx), not
  // 'in_transit' — that mismatch meant transit orders never showed up here.
  const trackableOrders = (orders || []).filter(o =>
    ['collected', 'dispatched', 'transit'].includes(o.status) && o.tracking_number
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
    // We can't automatically pull ST Courier's status from the frontend
    // (their tracking page is a plain server-rendered form, not a public
    // API) — this loads the list so she can check each one herself via the
    // "Track" button and record what she sees with one tap.
    const checkResults = trackableOrders.map(order => ({ order }));

    setResults(checkResults);
    setLastChecked(new Date());
    setChecking(false);
    showToast(`Loaded ${checkResults.length} orders to check`, 'success');
  };

  // Oldest-checked-first, capped at 5 — same "small daily batch, rotate
  // through the list" pacing as originally planned, just manually triggered
  // now instead of silently running on page load.
  const autoCandidates = [...trackableOrders]
    .sort((a, b) => new Date(a.st_courier_last_checked_at || 0) - new Date(b.st_courier_last_checked_at || 0))
    .slice(0, 5);

  const handleAutoCheck = async () => {
    if (autoCandidates.length === 0) {
      showToast('No active shipments with tracking numbers to check', 'error');
      return;
    }
    setAutoRunning(true);
    setAutoResults([]);
    let deliveredCount = 0;

    for (let i = 0; i < autoCandidates.length; i++) {
      const order = autoCandidates[i];
      setAutoProgress({ current: i + 1, total: autoCandidates.length, label: `${order.customer_name} (${order.tracking_number})` });
      const outcome = await dbService.checkOneStCourierAwb(order);
      if (outcome.delivered) deliveredCount++;
      setAutoResults(prev => [...prev, { order, ...outcome }]);
      if (i < autoCandidates.length - 1) {
        await new Promise(r => setTimeout(r, 2500 + Math.random() * 2000));
      }
    }

    setAutoProgress(null);
    setAutoRunning(false);
    const now = new Date();
    const today = todayISO();
    await dbService.setAppSetting('st_courier_auto_check', { date: today, at: now.toISOString() });
    setAutoLastRunDate(today);
    setAutoLastRunAt(now.toISOString());
    showToast(
      deliveredCount > 0
        ? `Checked ${autoCandidates.length} — ${deliveredCount} newly marked Delivered`
        : `Checked ${autoCandidates.length} order(s)`,
      'success'
    );
    if (onOrderUpdate) onOrderUpdate();
  };

  const handleMarkDelivered = async (order) => {
    const { error } = await dbService.updateSalesOrder({
      id: order.id,
      status: 'delivered',
      actualDeliveryDate: new Date().toISOString().split('T')[0],
    });
    if (error) {
      showToast('Error updating order', 'error');
      return;
    }

    // Update local results
    setResults(prev => prev.filter(r => r.order.id !== order.id));
    showToast(`${order.order_number} marked as Delivered!`, 'success');
    if (onOrderUpdate) onOrderUpdate();
  };

  const handleMarkOutForDelivery = async (order) => {
    const { error } = await dbService.updateSalesOrder({ id: order.id, status: 'transit' });
    if (error) {
      showToast('Error updating order', 'error');
      return;
    }
    showToast(`${order.order_number} → Out for Delivery`, 'success');
    if (onOrderUpdate) onOrderUpdate();
  };

  const handleFlagStuck = async (order) => {
    const note = `⚠️ Checked ${formatDate(new Date())} — not moving`;
    const { error } = await dbService.updateSalesOrder({ id: order.id, internalNotes: note });
    if (error) {
      showToast('Error saving note', 'error');
      return;
    }
    showToast(`${order.order_number} flagged for follow-up`, 'success');
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

      {/* ST Courier Auto-Check */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-gray-900 text-sm">ST Courier Auto-Check</h3>
          <span className="text-xs text-gray-400">— pulls real status from ST Courier's site, no manual lookup</span>
        </div>

        {autoRunning && autoProgress ? (
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Checking {autoProgress.current} of {autoProgress.total}... {autoProgress.label}
          </div>
        ) : autoAlreadyRanToday ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            Already checked today{autoLastRunAt ? ` at ${new Date(autoLastRunAt).toLocaleTimeString('en-IN')}` : ''} — next check available tomorrow
          </div>
        ) : (
          <button
            onClick={handleAutoCheck}
            disabled={autoCandidates.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            Check Today's Batch ({autoCandidates.length} order{autoCandidates.length !== 1 ? 's' : ''})
          </button>
        )}

        {autoResults.length > 0 && (
          <div className="space-y-1 pt-1">
            {autoResults.map(({ order, result, error, delivered }) => (
              <div key={order.id} className="flex items-center gap-2 text-xs bg-white border border-gray-100 rounded px-2.5 py-1.5">
                <span>{error ? '⚠️' : delivered ? '✅' : result?.found ? '🚚' : '❓'}</span>
                <span className="font-medium text-gray-800">{order.customer_name}</span>
                <span className="text-gray-400">({order.order_number})</span>
                <span className="ml-auto text-gray-600">
                  {error ? <span className="text-red-600">{error}</span> : result?.found ? result.status : (result?.error || 'Not found')}
                </span>
              </div>
            ))}
          </div>
        )}
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
          {results.map(({ order }) => (
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
                  {order.internal_notes && (
                    <p className="text-xs text-red-600 mt-1">{order.internal_notes}</p>
                  )}
                </div>
                <button
                  onClick={() => { openTrackingPage(order.tracking_number); showToast(`${order.tracking_number} copied — paste it into the search box`, 'success'); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200 whitespace-nowrap"
                >
                  <ExternalLink className="w-3 h-3" /> Check
                </button>
              </div>
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => handleMarkDelivered(order)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200"
                >
                  🟢 Delivered
                </button>
                <button
                  onClick={() => handleMarkOutForDelivery(order)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium hover:bg-yellow-200"
                >
                  🟡 Out for Delivery
                </button>
                <button
                  onClick={() => handleFlagStuck(order)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200"
                >
                  🔴 Stuck
                </button>
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
                  <span className="text-xs text-green-600 ml-2">Delivered: {formatDate(order.actual_delivery_date)}</span>
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
