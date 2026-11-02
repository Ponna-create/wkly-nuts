import React, { useState, useMemo, useEffect } from 'react';
import { X, MessageCircle, ExternalLink, Search, History, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { dbService } from '../../services/supabase';
import { fillTemplate, loadTemplates } from './WhatsAppSender';
import CustomerDetailModal from '../CustomerDetailModal';
import { formatDateTime, formatDate } from '../../utils/dateFormat';
import { MAX_COURIER_COST } from '../../utils/courierSuggest';
import { cleanTracking } from '../../utils/slipNumbers';
import { getCouriers, setCustomCouriers, isBuiltInCourier, patternFromExample, courierForNumber, courierOf, isStOrder, isOnTheWay, checkFailed, parcelAttention, STUCK_DAYS } from '../../utils/couriers';

// Courier tracking pages can't be pre-filled via URL (ST's form does a
// server-side AJAX round trip, not a plain GET) — so the closest thing to
// "one click" is copying the number and opening their page for her to paste in.
const openTrackingPage = (awb, link) => {
  navigator.clipboard?.writeText(awb).catch(() => {});
  window.open(link, '_blank');
};
const CHECKS_PER_CLICK = 5;
const RECENT_DAYS = 7;
const dayStr = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// The day a parcel left; older orders may only have an order date.
const parcelDay = (o) => String(o.dispatch_date || o.order_date || '').slice(0, 10);

// One row per courier-tracked order, for every courier. ST Courier updates by
// itself each morning (api/st-courier-daily.js); any other courier has a Track
// button and she updates the status here with one tap. Only what the courier
// alone can tell us is raised as needing attention: slip problems are dealt with
// when the slip is scanned.
export default function CourierDashboard({ orders, onClose, onUpdate, showToast }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [historyProfile, setHistoryProfile] = useState(null);
  // Which cell is being edited — { orderId, field } — plus its live draft
  // value, so typing doesn't touch the real order until Enter/blur commits it.
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [couriers, setCouriers] = useState(() => getCouriers());
  const [courierFilter, setCourierFilter] = useState('all');
  const [fromDate, setFromDate] = useState(() => dayStr(RECENT_DAYS - 1));
  const [toDate, setToDate] = useState(() => dayStr());
  const [showCourierForm, setShowCourierForm] = useState(false);
  const [newCourier, setNewCourier] = useState({ name: '', link: '', example: '' });
  const [checking, setChecking] = useState(null); // { current, total } while Check now runs
  const [daily, setDaily] = useState(null);

  useEffect(() => {
    dbService.getAppSetting('stCourierDaily').then(({ data }) => setDaily(data || null));
  }, []);

  const allTracked = useMemo(() => (orders || []).filter(o => o.tracking_number), [orders]);
  const shown = useMemo(() => (courierFilter === 'all' ? allTracked : allTracked.filter(o => courierOf(o) === courierFilter)), [allTracked, courierFilter]);
  const courierNames = useMemo(() => [...new Set([...couriers.map(c => c.name), ...allTracked.map(courierOf)])], [couriers, allTracked]);
  const linkFor = (order) => couriers.find(c => c.name === courierOf(order))?.link;
  const attention = useMemo(() => shown.map(o => ({ order: o, issue: parcelAttention(o) })).filter(x => x.issue), [shown]);
  const onTheWayCount = shown.filter(isOnTheWay).length;
  const deliveredThisWeek = shown.filter(o => o.status === 'delivered' && Date.now() - Date.parse(o.actual_delivery_date) <= 7 * 86400000).length;
  const stCheckable = useMemo(() => allTracked.filter(o => isOnTheWay(o) && isStOrder(o))
    .sort((a, b) => new Date(a.st_courier_last_checked_at || 0) - new Date(b.st_courier_last_checked_at || 0))
    .slice(0, CHECKS_PER_CLICK), [allTracked]);

  // Same "trackedOrders" list, but customer service needs to find someone by
  // phone number too — e.g. a customer calls about a delivery issue and all
  // she has is their number.
  const trackedOrders = useMemo(() => {
    const list = shown;
    const q = searchTerm.trim().toLowerCase();
    // A customer calling could be about any date, so a search looks through all of them.
    if (!q) {
      return list.filter(o => (!fromDate || parcelDay(o) >= fromDate) && (!toDate || parcelDay(o) <= toDate))
        .sort((a, b) => parcelDay(b).localeCompare(parcelDay(a)));
    }
    return list.filter(o =>
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.tracking_number || '').toLowerCase().includes(q) ||
      (o.phone || '').includes(q)
    );
  }, [shown, searchTerm, fromDate, toDate]);

  // Builds the same profile shape CustomerDetailModal expects, from whatever
  // orders this customer has (any status, not just courier-tracked ones) —
  // so "View History" shows the full picture, not just this one shipment.
  const openHistory = (order) => {
    const key = order.customer_id || order.customer_name;
    const customerOrders = (orders || []).filter(o => (o.customer_id || o.customer_name) === key);
    const dates = customerOrders.map(o => new Date(o.order_date)).filter(d => !isNaN(d));
    const ltv = customerOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const lastOrderDate = dates.length ? new Date(Math.max(...dates)) : null;
    setHistoryProfile({
      key,
      name: order.customer_name,
      phone: order.phone,
      city: order.shipping_city,
      orderCount: customerOrders.length,
      ltv,
      firstOrderDate: dates.length ? new Date(Math.min(...dates)) : null,
      lastOrderDate,
      daysSinceLast: lastOrderDate ? Math.floor((new Date() - lastOrderDate) / (1000 * 60 * 60 * 24)) : null,
    });
  };

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

  const handleTrackClick = (order) => {
    const link = linkFor(order);
    if (!link) return;
    openTrackingPage(order.tracking_number, link);
    showToast(`${order.tracking_number} copied — paste it into ${courierOf(order)}'s search box`, 'success');
  };

  const handleCheckNow = async () => {
    if (checking || stCheckable.length === 0) return;
    let delivered = 0;
    for (let i = 0; i < stCheckable.length; i++) {
      setChecking({ current: i + 1, total: stCheckable.length });
      const outcome = await dbService.checkOneStCourierAwb(stCheckable[i]);
      if (outcome.delivered) delivered++;
      if (i < stCheckable.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
    setChecking(null);
    showToast(`Checked ${stCheckable.length}${delivered ? `, ${delivered} delivered` : ''}`, 'success');
    onUpdate();
  };

  const handleCourierChange = async (order, courierName) => {
    const { error } = await dbService.updateSalesOrder({ id: order.id, courierName });
    if (error) { showToast('Error saving courier', 'error'); return; }
    showToast(`${order.order_number} → ${courierName}`, 'success');
    onUpdate();
  };

  const addCourier = () => {
    const name = newCourier.name.trim();
    if (!name) { showToast('Enter the courier name', 'error'); return; }
    if (couriers.some(c => c.name.toLowerCase() === name.toLowerCase())) { showToast(`${name} is already in the list`, 'error'); return; }
    const pattern = newCourier.example.trim() ? patternFromExample(newCourier.example) : null;
    if (newCourier.example.trim() && !pattern) { showToast('That example number is too short', 'error'); return; }
    let link = newCourier.link.trim();
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    const custom = couriers.filter(c => !isBuiltInCourier(c.name));
    setCustomCouriers([...custom, { name, link, auto: false, pattern }]);
    setCouriers(getCouriers());
    setNewCourier({ name: '', link: '', example: '' });
    setShowCourierForm(false);
    showToast(`${name} added`, 'success');
  };

  const removeCourier = (name) => {
    setCustomCouriers(couriers.filter(c => !isBuiltInCourier(c.name) && c.name !== name));
    setCouriers(getCouriers());
    if (courierFilter === name) setCourierFilter('all');
  };

  const startEdit = (order, field, currentValue) => {
    setEditingCell({ orderId: order.id, field });
    setEditValue(currentValue != null ? String(currentValue) : '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const commitEdit = async (order) => {
    if (!editingCell) return;
    const { field } = editingCell;
    const raw = editValue.trim();
    if (field === 'trackingNumber') {
      const code = cleanTracking(raw);
      if (!code || code === cleanTracking(order.tracking_number)) { cancelEdit(); return; }
      const duplicate = (orders || []).find(o => o.id !== order.id && cleanTracking(o.tracking_number) === code);
      if (duplicate) { showToast(`${code} is already on ${duplicate.order_number} (${duplicate.customer_name})`, 'error'); return; }
      const courier = courierForNumber(code, couriers);
      if (!courier && !window.confirm(`${code} doesn't match any courier's numbers. Save it anyway?`)) return;
      const { error } = await dbService.updateSalesOrder({ id: order.id, trackingNumber: code, stCourierStatus: null, ...(courier && { courierName: courier }) });
      cancelEdit();
      if (error) { showToast('Error saving — try again', 'error'); return; }
      showToast(`${order.order_number} updated`, 'success');
      onUpdate();
      return;
    }
    const num = raw === '' ? null : parseFloat(raw);
    if (raw !== '' && Number.isNaN(num)) {
      showToast('Enter a valid number', 'error');
      return;
    }
    const original = field === 'shippingWeight' ? order.shipping_weight : order.courier_amount;
    if ((parseFloat(original) ?? null) === num || (original == null && num == null)) {
      cancelEdit();
      return; // nothing actually changed — skip the write
    }
    if (field === 'courierAmount' && num > MAX_COURIER_COST && !window.confirm(`₹${num} for one parcel is unusually high. Save it anyway?`)) {
      cancelEdit();
      return;
    }
    // With both filled in, this is her checked figure, the same as OK on Scan
    // Slips, so it counts towards the courier cost suggestions.
    const weight = field === 'shippingWeight' ? num : parseFloat(order.shipping_weight);
    const cost = field === 'courierAmount' ? num : parseFloat(order.courier_amount);
    const { error } = await dbService.updateSalesOrder({
      id: order.id,
      [field]: num,
      ...(weight > 0 && cost > 0 && { courierConfirmedAt: new Date().toISOString() }),
    });
    cancelEdit();
    if (error) {
      showToast('Error saving — try again', 'error');
      return;
    }
    showToast(`${order.order_number} updated`, 'success');
    onUpdate();
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
            <p className="text-sm text-gray-500 mt-1">Showing {trackedOrders.length} of {shown.length} tracked order{shown.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-xs font-medium text-purple-600">On the way</p>
              <p className="text-xl font-bold text-purple-900">{onTheWayCount}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-medium text-green-600">Delivered this week</p>
              <p className="text-xl font-bold text-green-900">{deliveredThisWeek}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-600">Stuck or not delivered</p>
              <p className="text-xl font-bold text-amber-900">{attention.length}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['all', ...courierNames].map(name => (
              <button
                key={name}
                onClick={() => setCourierFilter(name)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${courierFilter === name ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {name === 'all' ? 'All couriers' : name}
              </button>
            ))}
            <button onClick={() => setShowCourierForm(v => !v)} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50">
              <Plus className="w-3 h-3" /> Add courier
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {daily ? `ST Courier checked ${new Date(daily.lastRun).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'ST Courier daily check has not run yet'}
              </span>
              <button
                onClick={handleCheckNow}
                disabled={Boolean(checking) || stCheckable.length === 0}
                title={`Checks the ${CHECKS_PER_CLICK} ST Courier parcels not checked for the longest`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                {checking ? `Checking ${checking.current} of ${checking.total}...` : 'Check now'}
              </button>
            </div>
          </div>

          {showCourierForm && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-xs text-gray-600">Courier name
                  <input value={newCourier.name} onChange={e => setNewCourier(p => ({ ...p, name: e.target.value }))} placeholder="DTDC"
                    className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
                </label>
                <label className="text-xs text-gray-600">Tracking website (optional)
                  <input value={newCourier.link} onChange={e => setNewCourier(p => ({ ...p, link: e.target.value }))} placeholder="https://www.dtdc.in/tracking"
                    className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white" />
                </label>
                <label className="text-xs text-gray-600">One real number from its slip (optional)
                  <input value={newCourier.example} onChange={e => setNewCourier(p => ({ ...p, example: e.target.value }))} placeholder="D12345678"
                    className="mt-0.5 w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-mono bg-white" />
                </label>
              </div>
              <p className="text-[11px] text-gray-500">The example number lets Scan Slips recognise this courier's slips. Its parcels are tracked by hand: Track opens the website, and she marks the status.</p>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={addCourier} className="px-3 py-1.5 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700">Add</button>
                <button onClick={() => setShowCourierForm(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                {couriers.filter(c => !isBuiltInCourier(c.name)).map(c => (
                  <span key={c.name} className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700">
                    {c.name}
                    <button onClick={() => removeCourier(c.name)} title={`Remove ${c.name}`} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {attention.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-bold text-gray-900 text-sm">Needs your attention <span className="font-normal text-xs text-gray-500">— not delivered, or no movement for over {STUCK_DAYS} days</span></h3>
              {attention.map(({ order: o, issue }) => (
                <div key={o.id} className={`flex flex-wrap items-center gap-2 p-2.5 border rounded-lg text-sm ${issue.kind === 'problem' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <span className="font-medium text-gray-900">{o.customer_name}</span>
                  <span className="text-xs text-gray-500">{o.order_number} · {courierOf(o)} · <span className="font-mono">{o.tracking_number}</span></span>
                  <span className={`text-xs font-medium ${issue.kind === 'problem' ? 'text-red-700' : 'text-amber-800'}`}>{issue.text}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <button onClick={() => handleSendWhatsApp(o)} title="Message the customer on WhatsApp"
                      className="p-1.5 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"><MessageCircle className="w-3.5 h-3.5" /></button>
                    {linkFor(o) && (
                      <button onClick={() => handleTrackClick(o)} className="flex items-center gap-1 px-2 py-1 text-xs bg-white text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-50">
                        <ExternalLink className="w-3.5 h-3.5" /> Track
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[16rem] max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer, phone, order #, or tracking #..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
            <label className="text-xs font-medium text-gray-600">From
              <input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)}
                className="block mt-0.5 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </label>
            <label className="text-xs font-medium text-gray-600">To
              <input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)}
                className="block mt-0.5 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Today', from: dayStr(), to: dayStr() },
                { label: `Last ${RECENT_DAYS} days`, from: dayStr(RECENT_DAYS - 1), to: dayStr() },
                { label: 'Last 30 days', from: dayStr(29), to: dayStr() },
                { label: 'All', from: '', to: '' },
              ].map(r => (
                <button
                  key={r.label}
                  onClick={() => { setFromDate(r.from); setToDate(r.to); }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${fromDate === r.from && toDate === r.to ? 'bg-teal-50 text-teal-700 border-teal-300' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {trackedOrders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">{shown.length === 0 ? 'No courier-tracked orders yet — scan slips first.' : 'No parcels in these dates. Change the dates above or press All.'}</p>
          ) : (
            // Scrolls inside its own box, so the side scroll bar is always on screen
            // instead of at the very bottom of a long list.
            <div className="overflow-auto max-h-[55vh] border border-gray-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Order ID</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Dispatch Date</th>
                    <th className="px-3 py-2 text-left">Courier</th>
                    <th className="px-3 py-2 text-left">Weight</th>
                    <th className="px-3 py-2 text-left">Shipping Amt</th>
                    <th className="px-3 py-2 text-left">State</th>
                    <th className="px-3 py-2 text-left">Pincode</th>
                    <th className="px-3 py-2 text-left">Tracking #</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Latest from courier</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trackedOrders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{o.order_number}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.customer_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.dispatch_date ? formatDate(o.dispatch_date) : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <select value={courierOf(o)} onChange={(e) => handleCourierChange(o, e.target.value)}
                          className="px-1.5 py-1 border border-gray-200 rounded text-xs bg-white">
                          {courierNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {editingCell?.orderId === o.id && editingCell.field === 'shippingWeight' ? (
                          <input
                            autoFocus
                            type="number"
                            step="0.001"
                            inputMode="decimal"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(o)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(o);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-20 px-1.5 py-1 border border-teal-400 rounded text-sm"
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(o, 'shippingWeight', o.shipping_weight)}
                            className="inline-block min-w-[3.5rem] text-left bg-white border border-gray-300 hover:border-teal-500 hover:bg-teal-50 px-1.5 py-1 rounded"
                            title="Click to edit weight"
                          >
                            {o.shipping_weight != null ? `${o.shipping_weight} kg` : <span className="text-gray-400">Add</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {editingCell?.orderId === o.id && editingCell.field === 'courierAmount' ? (
                          <input
                            autoFocus
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(o)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(o);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-20 px-1.5 py-1 border border-teal-400 rounded text-sm"
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(o, 'courierAmount', o.courier_amount)}
                            className="inline-block min-w-[3.5rem] text-left bg-white border border-gray-300 hover:border-teal-500 hover:bg-teal-50 px-1.5 py-1 rounded"
                            title="Click to edit shipping amount"
                          >
                            {o.courier_amount != null ? `₹${o.courier_amount}` : <span className="text-gray-400">Add</span>}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.shipping_state || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{o.shipping_pincode || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                        {editingCell?.orderId === o.id && editingCell.field === 'trackingNumber' ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(o)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(o);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-32 px-1.5 py-1 border border-teal-400 rounded text-xs"
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(o, 'trackingNumber', o.tracking_number)}
                            className="inline-block min-w-[3.5rem] text-left bg-white border border-gray-300 hover:border-teal-500 hover:bg-teal-50 px-1.5 py-1 rounded"
                            title="Click to fix the tracking number"
                          >
                            {o.tracking_number}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{statusBadge(o.status)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {!isStOrder(o) ? (
                          <span className="text-gray-500">Tracked by hand</span>
                        ) : checkFailed(o) ? (
                          <span className="text-red-700">ST can't find this number — click it to fix</span>
                        ) : o.st_courier_status ? (
                          <>
                            <div className={/\bdelivered/i.test(o.st_courier_status) && !/un\s*deliver|not delivered/i.test(o.st_courier_status) ? 'text-green-700 font-medium' : 'text-gray-700'}>{o.st_courier_status}</div>
                            {o.st_courier_last_checked_at && <div className="text-gray-400">checked {formatDateTime(o.st_courier_last_checked_at)}</div>}
                          </>
                        ) : (
                          <span className="text-gray-400 italic">not checked yet</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openHistory(o)}
                            title="View this customer's full order history"
                            className="p-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSendWhatsApp(o)}
                            title="Send tracking on WhatsApp"
                            className="p-1.5 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                          {linkFor(o) && (
                            <button
                              onClick={() => handleTrackClick(o)}
                              title="Copy tracking # and open the courier's tracking page"
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 whitespace-nowrap"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Track
                            </button>
                          )}
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

      {historyProfile && (
        <CustomerDetailModal profile={historyProfile} orders={orders} onClose={() => setHistoryProfile(null)} />
      )}
    </div>
  );
}
