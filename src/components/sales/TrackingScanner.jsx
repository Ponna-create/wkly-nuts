import React, { useState, useRef, useMemo } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Image as ImageIcon, CheckCircle, AlertCircle, Package, Search, RotateCw, Pencil, Undo2, Keyboard, ImagePlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';
import { expectedWeightForOrder, cleanTracking, isValidTracking, isIndiaPostNumber, suggestTrackingFixes, nearbyNumbers } from '../../utils/slipNumbers';
import { findBarcodeAreas, readBarcode } from '../../utils/findBarcode';
import { readPrintedNumber } from '../../utils/slipDigits';
import { courierHistory, suggestCourier, CONFIRMED_NEEDED, MAX_COURIER_COST } from '../../utils/courierSuggest';

// Courier slips carry the consignment number as a 1-D barcode. QR codes are
// left out on purpose: the slip's "TRACK HERE" QR is a website link, not the
// number. The phone's own barcode reader is used where the browser has one
// (more robust than the JS decoder).
const SLIP_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39, Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODABAR, Html5QrcodeSupportedFormats.ITF, Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.UPC_A,
];
const makeSlipReader = (elementId) => new Html5Qrcode(elementId, {
  formatsToSupport: SLIP_FORMATS,
  useBarCodeDetectorIfSupported: true,
  verbose: false,
});
const loadImage = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
  img.onerror = reject;
  img.src = URL.createObjectURL(file);
});
const canvasToFile = (canvas, name) => new Promise((resolve, reject) => {
  canvas.toBlob(b => (b ? resolve(new File([b], name, { type: 'image/png' })) : reject(new Error('could not copy photo'))), 'image/png');
});
// The photo turned by a quarter, used by the turn button and the whole-photo attempt.
const rotateFile = async (file) => {
  const img = await loadImage(file);
  const c = document.createElement('canvas');
  c.width = img.height;
  c.height = img.width;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvasToFile(c, file.name);
};
const WORKING_SIZE = 1600; // big phone photos are shrunk first: more pixels don't help, and slow it all down
const prepareSlip = async (file) => {
  const img = await loadImage(file);
  const scale = Math.min(1, WORKING_SIZE / Math.max(img.width, img.height));
  const source = document.createElement('canvas');
  source.width = Math.round(img.width * scale);
  source.height = Math.round(img.height * scale);
  const ctx = source.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, source.width, source.height);
  const { data } = ctx.getImageData(0, 0, source.width, source.height);
  const gray = new Uint8ClampedArray(source.width * source.height);
  for (let i = 0; i < gray.length; i++) gray[i] = (data[4 * i] * 299 + data[4 * i + 1] * 587 + data[4 * i + 2] * 114) / 1000;
  return { source, gray };
};
// The number on a slip photo. readBy says how far to trust it:
// 'barcode' is exact, 'digits' is for her to compare with the photo, and null
// means not read, with any numbers seen once offered as candidates.
const readSlipNumber = async (reader, file) => {
  let odd = null;
  let prep = null;
  let areas = [];
  try {
    prep = await prepareSlip(file);
    areas = findBarcodeAreas(prep.gray, prep.source.width, prep.source.height);
    const text = readBarcode(prep.gray, prep.source.width, prep.source.height, areas);
    if (isValidTracking(text)) return { code: text, readBy: 'barcode', candidates: [] };
    odd = text;
  } catch { /* a format the browser can't draw: try its own barcode reader below */ }
  // The whole photo: this is where a phone's built-in barcode reader helps.
  for (const turn of [false, true]) {
    try {
      const text = cleanTracking(await reader.scanFile(turn ? await rotateFile(file) : file, false));
      if (isValidTracking(text)) return { code: text, readBy: 'barcode', candidates: [] };
      if (text.length >= 8) odd = odd || text;
    } catch { /* try the next one */ }
  }
  if (!prep) return { code: odd, readBy: null, candidates: [] };
  const { agreed, candidates } = await readPrintedNumber(prep.source, areas);
  if (agreed) return { code: agreed, readBy: 'digits', candidates };
  return { code: odd, readBy: null, candidates };
};

// Slips are handed over in the order packing finished, so anything the courier
// has already collected comes first within a date.
const HANDED_OVER = ['fulfilled', 'collected'];
const handoverRank = (o) => (HANDED_OVER.includes(o.status) ? 0 : 1);
const orderDay = (o) => String(o.order_date || '').slice(0, 10);
const showDay = (d) => (d ? d.split('-').reverse().join('-') : '');
const orderPin = (o) => String(o.shipping_pincode || '').trim() || (String(o.shipping_address || '').match(/\b\d{6}\b/) || [''])[0];

let reviewIdCounter = 0;
const nextReviewId = () => `rv-${Date.now()}-${reviewIdCounter++}`;

// Upload a stack of slip photos: the app reads each barcode, with no AI, and she
// reads the name on the photo and taps the order from the date she has chosen.
export default function TrackingScanner({ orders, onClose, onUpdate }) {
  const { state, showToast, dispatch } = useApp();
  const skus = state.skus || [];
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scannedCode, setScannedCode] = useState(null); // live camera single-scan only
  const [linkedOrders, setLinkedOrders] = useState({}); // orderId -> tracking number
  const [linkedDetails, setLinkedDetails] = useState({}); // orderId -> { before, dispatchDate, courierName, file, previewUrl }
  const [editingLink, setEditingLink] = useState(null); // { id, code, date } while a linked slip is being edited
  const [saving, setSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null); // { current, total } while a photo batch runs
  const [reviewQueue, setReviewQueue] = useState([]); // slips waiting for her to pick the order
  const [activeSlipId, setActiveSlipId] = useState(null); // slip whose order list is open; the first one if none chosen
  const [pickDate, setPickDate] = useState(null); // order date she's choosing from; the newest if none chosen
  const [orderSearch, setOrderSearch] = useState('');
  const [zoomedUrl, setZoomedUrl] = useState(null); // full-size photo preview overlay
  const [courierEdits, setCourierEdits] = useState({}); // orderId -> { weight, cost } typed in
  const [courierSaved, setCourierSaved] = useState({}); // orderId -> { weight, cost } confirmed
  const html5QrCodeRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const processingRef = useRef(false);
  const fileInputRef = useRef(null);
  const clearerPhotoInputRef = useRef(null);
  const clearerPhotoForRef = useRef(null); // the slip a replacement photo is for
  const linkedCodesRef = useRef({}); // tracking number -> order, for slips repeated within this sitting

  const unlinkedOrders = useMemo(() => orders.filter(o => !linkedOrders[o.id]), [orders, linkedOrders]);
  // Only dates that still have an order waiting for a number, newest first.
  const dateOptions = useMemo(() => {
    const counts = {};
    unlinkedOrders.forEach(o => { counts[orderDay(o)] = (counts[orderDay(o)] || 0) + 1; });
    return Object.keys(counts).sort().reverse().map(day => ({ day, count: counts[day] }));
  }, [unlinkedOrders]);
  const shownDate = dateOptions.some(d => d.day === pickDate) ? pickDate : dateOptions[0]?.day;
  // That date's orders, or while she's searching, matches from every date.
  const orderList = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    const list = !q
      ? unlinkedOrders.filter(o => orderDay(o) === shownDate)
      : unlinkedOrders.filter(o =>
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.phone || '').includes(q) ||
        (o.shipping_address || '').toLowerCase().includes(q) ||
        (o.shipping_city || '').toLowerCase().includes(q) ||
        orderPin(o).includes(q));
    return [...list].sort((a, b) => handoverRank(a) - handoverRank(b) || orderDay(b).localeCompare(orderDay(a)) || String(a.order_number).localeCompare(String(b.order_number)));
  }, [unlinkedOrders, shownDate, orderSearch]);
  // Two customers of the same name get a tag, so the place and pincode get a second look.
  const nameCounts = useMemo(() => {
    const counts = {};
    orderList.forEach(o => { const n = (o.customer_name || '').trim().toLowerCase(); counts[n] = (counts[n] || 0) + 1; });
    return counts;
  }, [orderList]);
  // One line under each order in the pick lists: the things that tell two
  // orders apart against a slip, which carries the place and the end of the pincode.
  const orderHint = (o) => [
    showDay(orderDay(o)),
    o.shipping_city || (o.shipping_address || '').split(',').slice(-2).join(',').trim(),
    orderPin(o) && `PIN ${orderPin(o)}`,
    (o.items || []).map(i => `${i.sku_name || i.skuName} ${i.pack_type || i.packType || ''} ×${i.quantity}`).join(', '),
    (() => { const w = expectedWeightForOrder(o, skus); return w != null ? `~${Math.round(w * 100) / 100} kg` : ''; })(),
  ].filter(Boolean).join(' · ');
  const linkedCount = Object.keys(linkedOrders).length;
  // Real numbers already saved, used to rank fixes for a mistyped number.
  const knownNumbers = useMemo(() => (state.salesOrders || []).map(o => cleanTracking(o.tracking_number)).filter(isValidTracking), [state.salesOrders]);

  // Courier cost + weight: confirmed by her on each slip. Suggestions learn
  // from confirmed slips (utils/courierSuggest.js).
  const history = useMemo(() => courierHistory(state.salesOrders), [state.salesOrders]);
  const suggestions = useMemo(() => {
    const out = {};
    Object.values(linkedDetails).forEach(({ before }) => { out[before.id] = suggestCourier(before, history, skus); });
    return out;
  }, [linkedDetails, history, skus]);
  const courierValue = (id, field) => {
    const e = courierEdits[id];
    if (e && e[field] !== undefined) return e[field];
    const v = suggestions[id]?.[field];
    return v != null ? String(v) : '';
  };
  const setCourierField = (id, field, value) => setCourierEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  const unconfirmedCount = Object.keys(linkedOrders).filter(id => !courierSaved[id]).length;

  const saveCourier = async (order) => {
    const weight = parseFloat(courierValue(order.id, 'weight'));
    const cost = parseFloat(courierValue(order.id, 'cost'));
    if (!(weight > 0) || !(cost > 0)) { showToast('Enter both the weight and the courier cost', 'error'); return; }
    if (cost > MAX_COURIER_COST && !window.confirm(`₹${cost} for one parcel is unusually high. Save it anyway?`)) return;
    const confirmedAt = new Date().toISOString();
    const { error: err } = await dbService.updateSalesOrder({ id: order.id, shippingWeight: weight, courierAmount: cost, courierConfirmedAt: confirmedAt });
    if (err) { showToast('Could not save the courier cost', 'error'); return; }
    const d = linkedDetails[order.id];
    dispatch({ type: 'UPDATE_SALES_ORDER', payload: { ...order, tracking_number: linkedOrders[order.id], courier_name: d?.courierName, dispatch_date: d?.dispatchDate, status: 'dispatched', shipping_weight: weight, courier_amount: cost, courier_confirmed_at: confirmedAt } });
    setCourierSaved(prev => ({ ...prev, [order.id]: { weight, cost } }));
  };
  const busy = batchProgress != null;

  const startScanner = async () => {
    try {
      setError(null);
      const html5QrCode = makeSlipReader('tracking-scan-reader');
      html5QrCodeRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (w, h) => ({ width: Math.floor(w * 0.85), height: Math.floor(Math.min(h, w) * 0.4) }) },
        onScanSuccess,
        () => {}
      );
      setScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setError('Could not access camera. Please allow camera permission.');
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error('Stop scanner error:', err);
      }
    }
    setScanning(false);
  };

  const onScanSuccess = (decodedText) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 2000) return;
    if (processingRef.current) return;
    lastScanTimeRef.current = now;
    setScannedCode(cleanTracking(decodedText));
  };

  // One physical consignment slip = one shipment, so the same tracking
  // number can never legitimately belong to two orders. Has to look through
  // every order: `orders` here only holds the ones with no number yet, so
  // checking that list could never find a duplicate.
  const findDuplicateTrackingOrder = (code, excludeOrderId) => {
    const clean = cleanTracking(code);
    const justLinked = linkedCodesRef.current[clean];
    if (justLinked && String(justLinked.id) !== String(excludeOrderId)) return justLinked;
    return (state.salesOrders || []).find(o => cleanTracking(o.tracking_number) === clean && String(o.id) !== String(excludeOrderId));
  };

  // Saves the tracking number onto an order. Returns true/false.
  const doLink = async (order, code, photo = {}) => {
    const duplicate = findDuplicateTrackingOrder(code, order.id);
    if (duplicate) {
      showToast(`Tracking ${code} is already on ${duplicate.order_number} (${duplicate.customer_name}) — not linking it to a second order`, 'error');
      return false;
    }
    const updatedOrder = {
      id: order.id,
      trackingNumber: code,
      courierName: isIndiaPostNumber(code) ? 'India Post' : (order.courier_name || 'ST Courier'),
      status: 'dispatched',
      dispatchDate: order.dispatch_date || new Date().toISOString().split('T')[0],
    };
    const { error } = await dbService.updateSalesOrder(updatedOrder);
    if (error) { showToast('Error saving tracking number', 'error'); return false; }

    dispatch({
      type: 'UPDATE_SALES_ORDER',
      payload: {
        ...order,
        tracking_number: code,
        courier_name: updatedOrder.courierName,
        status: 'dispatched',
        dispatch_date: updatedOrder.dispatchDate,
      },
    });
    linkedCodesRef.current[cleanTracking(code)] = order;
    setLinkedOrders(prev => ({ ...prev, [order.id]: code }));
    setLinkedDetails(prev => ({ ...prev, [order.id]: { before: order, dispatchDate: updatedOrder.dispatchDate, courierName: updatedOrder.courierName, ...photo } }));
    return true;
  };

  // Puts the order back exactly as it was, and the slip back at the top of the
  // list to pick again. Saving as dispatched takes the boxes out of stock, so
  // they go back too, unless they had already gone out before this slip.
  const undoLink = async (id) => {
    const d = linkedDetails[id];
    if (!d || saving) return;
    const { before } = d;
    setSaving(true);
    const { error: err } = await dbService.updateSalesOrder({
      id,
      trackingNumber: before.tracking_number ?? null,
      courierName: before.courier_name ?? null,
      status: before.status,
      dispatchDate: before.dispatch_date ?? null,
      shippingWeight: before.shipping_weight ?? null,
      courierAmount: before.courier_amount ?? null,
      courierConfirmedAt: before.courier_confirmed_at ?? null,
    });
    if (err) { setSaving(false); showToast('Could not undo this slip', 'error'); return; }
    if (!before.stock_deducted_at) await dbService.restockInventoryForOrder(before, 'Slip link undone');
    setSaving(false);
    dispatch({ type: 'UPDATE_SALES_ORDER', payload: before });
    const code = linkedOrders[id];
    delete linkedCodesRef.current[cleanTracking(code)];
    const without = (prev) => { const n = { ...prev }; delete n[id]; return n; };
    setLinkedOrders(without);
    setLinkedDetails(without);
    setCourierEdits(without);
    setCourierSaved(without);
    if (editingLink?.id === id) setEditingLink(null);
    setReviewQueue(prev => [{ id: nextReviewId(), trackingNumber: code, readBy: d.readBy ?? 'picked', candidates: [], done: false, reason: null, file: d.file, previewUrl: d.previewUrl }, ...prev]);
    setActiveSlipId(null);
    setOrderSearch('');
    showToast(`Undone — ${before.order_number} is back in the list`, 'success');
  };

  const saveLinkEdit = async () => {
    if (!editingLink || saving) return;
    const { id, date } = editingLink;
    const code = cleanTracking(editingLink.code);
    const d = linkedDetails[id];
    if (!code || !date) { showToast('Enter the tracking number and dispatch date', 'error'); return; }
    if (!okToSaveNumber(code)) return;
    const duplicate = findDuplicateTrackingOrder(code, id);
    if (duplicate) { showToast(`Tracking ${code} is already on ${duplicate.order_number} (${duplicate.customer_name})`, 'error'); return; }
    const courierName = isIndiaPostNumber(code) ? 'India Post' : d.courierName;
    setSaving(true);
    const { error: err } = await dbService.updateSalesOrder({ id, trackingNumber: code, dispatchDate: date, courierName });
    setSaving(false);
    if (err) { showToast('Could not save the change', 'error'); return; }
    const saved = courierSaved[id];
    dispatch({
      type: 'UPDATE_SALES_ORDER',
      payload: {
        ...d.before, tracking_number: code, dispatch_date: date, courier_name: courierName, status: 'dispatched',
        ...(saved && { shipping_weight: saved.weight, courier_amount: saved.cost }),
      },
    });
    delete linkedCodesRef.current[cleanTracking(linkedOrders[id])];
    linkedCodesRef.current[code] = d.before;
    setLinkedOrders(prev => ({ ...prev, [id]: code }));
    setLinkedDetails(prev => ({ ...prev, [id]: { ...prev[id], dispatchDate: date, courierName } }));
    setEditingLink(null);
    showToast('Saved', 'success');
  };

  const okToSaveNumber = (code) => isValidTracking(code)
    || window.confirm(`${code} doesn't look like a real ST Courier or India Post number. It will fail the daily courier check. Save it anyway?`);

  // Single live-camera scan: she's holding the slip under the camera, so she picks straight away.
  const handlePickOrder = async (order) => {
    if (!scannedCode || saving || !okToSaveNumber(scannedCode)) return;
    setSaving(true);
    const ok = await doLink(order, scannedCode);
    setSaving(false);
    if (!ok) return;
    showToast(`${order.order_number} → ${scannedCode}`, 'success');
    setScannedCode(null);
    setOrderSearch('');
  };

  // Reads the barcode on every photo, then queues them all for her to pick the order.
  const handleFileSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    if (scanning) await stopScanner();

    setError(null);
    setBatchProgress({ current: 0, total: files.length });
    const newReview = [];
    const seen = new Set(reviewQueue.map(r => r.trackingNumber).filter(Boolean));
    const tally = { barcode: 0, digits: 0, none: 0 };
    for (let i = 0; i < files.length; i++) {
      setBatchProgress({ current: i + 1, total: files.length });
      if (!html5QrCodeRef.current) html5QrCodeRef.current = makeSlipReader('tracking-scan-reader');
      const previewUrl = URL.createObjectURL(files[i]);
      const { code, readBy, candidates } = await readSlipNumber(html5QrCodeRef.current, files[i]);
      tally[readBy || 'none']++;
      const owner = code && findDuplicateTrackingOrder(code);
      let reason = null;
      if (owner) reason = `Already linked to ${owner.order_number} (${owner.customer_name}) — nothing to do, press Skip`;
      else if (seen.has(code)) reason = 'Same slip as another photo in this stack — press Skip';
      if (code) seen.add(code);
      newReview.push({ id: nextReviewId(), trackingNumber: code, readBy, candidates, done: Boolean(owner), reason, file: files[i], previewUrl });
    }
    setBatchProgress(null);
    setReviewQueue(prev => [...prev, ...newReview]);
    const notes = [`${tally.barcode} read from the barcode`, tally.digits && `${tally.digits} to compare`, tally.none && `${tally.none} not read`].filter(Boolean);
    showToast(notes.join(', '), tally.none ? 'info' : 'success');
  };

  const assignReviewItem = async (item, order) => {
    if (!item.trackingNumber || saving || !okToSaveNumber(item.trackingNumber)) return;
    setSaving(true);
    const ok = await doLink(order, item.trackingNumber, { file: item.file, previewUrl: item.previewUrl, readBy: item.readBy });
    setSaving(false);
    if (!ok) return;
    showToast(`${order.order_number} → ${item.trackingNumber}`, 'success');
    setReviewQueue(prev => prev.filter(r => r.id !== item.id));
    setActiveSlipId(null);
    setOrderSearch('');
  };

  const updateItemTracking = (id, value, readBy = 'typed') => setReviewQueue(prev => prev.map(r => r.id === id ? { ...r, trackingNumber: cleanTracking(value), readBy } : r));
  const startTyping = (id) => setReviewQueue(prev => prev.map(r => r.id === id ? { ...r, typing: true } : r));

  // WhatsApp shrinks photos, so a slip that won't read may read from a clearer copy.
  const handleClearerPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = clearerPhotoForRef.current;
    if (!file || !id) return;
    setBatchProgress({ current: 1, total: 1 });
    if (scanning) await stopScanner();
    if (!html5QrCodeRef.current) html5QrCodeRef.current = makeSlipReader('tracking-scan-reader');
    const { code, readBy, candidates } = await readSlipNumber(html5QrCodeRef.current, file);
    const owner = code && findDuplicateTrackingOrder(code);
    const previewUrl = URL.createObjectURL(file);
    setReviewQueue(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
      return {
        ...r, file, previewUrl, trackingNumber: code, readBy, candidates, done: Boolean(owner), typing: false,
        reason: owner ? `Already linked to ${owner.order_number} (${owner.customer_name}) — nothing to do, press Skip` : null,
      };
    }));
    setBatchProgress(null);
    showToast(code && readBy ? 'Number read from the clearer photo' : "This photo couldn't be read either", code && readBy ? 'success' : 'info');
  };

  // Slip photos are often sideways, which makes the handwriting hard to read.
  const turnItemPhoto = async (item) => {
    try {
      const file = await rotateFile(item.file);
      const previewUrl = URL.createObjectURL(file);
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      setReviewQueue(prev => prev.map(r => r.id === item.id ? { ...r, file, previewUrl } : r));
    } catch {
      showToast('Could not turn this photo', 'error');
    }
  };

  const dismissReviewItem = (id) => {
    setReviewQueue(prev => {
      const item = prev.find(r => r.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(r => r.id !== id);
    });
    setActiveSlipId(null);
    setOrderSearch('');
  };

  const handleFinish = async () => {
    if (unconfirmedCount > 0 && !window.confirm(`${unconfirmedCount} linked slip(s) have no courier cost and weight confirmed yet. Close anyway?`)) return;
    await stopScanner();
    if (linkedCount > 0) onUpdate();
    onClose();
  };

  // Numbers beside the ones in this stack, or failing that, the latest saved.
  const usedNumbers = [...knownNumbers, ...Object.values(linkedOrders), ...reviewQueue.map(r => r.trackingNumber).filter(Boolean)];
  const stackNumbers = [...reviewQueue.map(r => r.trackingNumber), ...Object.values(linkedOrders)].filter(isValidTracking);
  const nearbyForUnread = nearbyNumbers(stackNumbers.length ? stackNumbers : knownNumbers.slice(0, 3), usedNumbers);

  const activeId = reviewQueue.some(r => r.id === activeSlipId) ? activeSlipId : reviewQueue[0]?.id;

  const renderOrderList = (onPick, disabled) => (
    <div className="space-y-1.5">
      <input
        value={orderSearch}
        onChange={(e) => setOrderSearch(e.target.value)}
        placeholder="Order from another date? Search name, order #, phone, city..."
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm"
      />
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {orderList.map(o => (
          <button
            key={o.id}
            onClick={() => onPick(o)}
            disabled={disabled}
            className="w-full text-left px-2 py-1.5 border border-gray-200 bg-white rounded hover:border-teal-400 hover:bg-teal-50 text-sm disabled:opacity-50"
          >
            <span className="font-semibold text-gray-900">{o.customer_name}</span>
            <span className="text-xs text-gray-500 ml-1.5">{o.order_number}</span>
            {nameCounts[(o.customer_name || '').trim().toLowerCase()] > 1 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-semibold">Same name — check PIN</span>
            )}
            <span className="block text-[11px] text-gray-500">{orderHint(o)}</span>
          </button>
        ))}
        {orderList.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">No matching orders</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Scan Tracking Slips</h2>
            <p className="text-sm text-gray-500 mt-1">
              {linkedCount} linked{reviewQueue.length > 0 ? ` · ${reviewQueue.length} to pick` : ''} · {unlinkedOrders.length} order{unlinkedOrders.length !== 1 ? 's' : ''} left
            </p>
          </div>
          <button onClick={handleFinish} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            Order date
            <select
              value={shownDate || ''}
              onChange={(e) => { setPickDate(e.target.value); setOrderSearch(''); }}
              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {dateOptions.map(d => (
                <option key={d.day} value={d.day}>{showDay(d.day) || 'No date'} — {d.count} order{d.count !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </label>

          {batchProgress && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5">
              <p className="text-center text-sm text-blue-700 font-medium">
                Reading photo {batchProgress.current} of {batchProgress.total}...
              </p>
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((batchProgress.current / batchProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {!scannedCode && (
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '180px' }}>
              <div id="tracking-scan-reader" className="w-full" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900 p-2">
                  <button onClick={startScanner} disabled={busy}
                    className="flex items-center gap-3 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-lg disabled:opacity-50">
                    <Camera className="w-6 h-6" /> Start Camera
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-medium text-sm disabled:opacity-50">
                    <ImageIcon className="w-4 h-4" /> {busy ? 'Reading photos...' : 'Upload Slip Photos'}
                  </button>
                  <p className="text-xs text-gray-400 text-center">Select the whole stack at once — it reads each barcode, then you pick the order for each slip</p>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelected} className="hidden" />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {scannedCode && (
            <div className="space-y-3">
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
                <p className="text-xs text-teal-600 font-medium">SCANNED CONSIGNMENT NUMBER</p>
                <p className="text-lg font-mono font-bold text-teal-900">{scannedCode}</p>
              </div>
              <p className="text-sm font-medium text-gray-700">Which order is this for?</p>
              {renderOrderList(handlePickOrder, saving)}
              <button
                onClick={() => setScannedCode(null)}
                className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-300"
              >
                Rescan this slip
              </button>
            </div>
          )}

          <input ref={clearerPhotoInputRef} type="file" accept="image/*" onChange={handleClearerPhoto} className="hidden" />

          {reviewQueue.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Pick the order for each slip ({reviewQueue.length})
              </h3>
              {reviewQueue.map(item => {
                const open = item.id === activeId;
                const numberLooksWrong = item.trackingNumber && !isValidTracking(item.trackingNumber);
                const fixes = numberLooksWrong ? suggestTrackingFixes(item.trackingNumber, knownNumbers) : [];
                const unread = !item.trackingNumber || (numberLooksWrong && item.readBy !== 'typed');
                const choices = unread ? [...new Set([...(item.candidates || []), ...fixes, ...nearbyForUnread])].slice(0, 8) : [];
                const label = unread
                  ? { text: "Couldn't read this slip", tone: 'bg-red-100 text-red-800' }
                  : item.readBy === 'barcode'
                    ? { text: 'Barcode read', tone: 'bg-green-100 text-green-800' }
                    : item.readBy === 'digits'
                      ? { text: 'Read from printed digits — compare with the photo', tone: 'bg-amber-200 text-amber-900' }
                      : item.readBy === 'picked'
                        ? { text: 'Chosen by you — compare with the photo', tone: 'bg-amber-200 text-amber-900' }
                        : { text: 'Typed by you', tone: 'bg-gray-200 text-gray-800' };
                return (
                  <div key={item.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                    {open && item.previewUrl && (
                      <div className="relative">
                        <button
                          onClick={() => setZoomedUrl(item.previewUrl)}
                          className="block w-full h-56 rounded border border-amber-300 overflow-hidden bg-gray-100"
                          title="Tap to enlarge"
                        >
                          <img src={item.previewUrl} alt="Slip" className="w-full h-full object-contain" />
                        </button>
                        <button
                          onClick={() => turnItemPhoto(item)}
                          className="absolute top-1.5 right-1.5 flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <RotateCw className="w-3.5 h-3.5" /> Turn
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2.5">
                      {!open && item.previewUrl && (
                        <img src={item.previewUrl} alt="Slip" className="flex-shrink-0 w-14 h-14 rounded border border-amber-300 object-cover bg-gray-100" />
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${label.tone}`}>{label.text}</span>
                          {item.trackingNumber && !item.typing && <span className="font-mono text-sm font-semibold text-gray-900">{item.trackingNumber}</span>}
                        </p>
                        {item.typing && (
                          <input
                            autoFocus
                            value={item.trackingNumber || ''}
                            onChange={(e) => updateItemTracking(item.id, e.target.value)}
                            placeholder="Type the number from the slip"
                            className={`w-full px-1.5 py-1 border rounded font-mono text-xs bg-white ${numberLooksWrong ? 'border-red-400' : 'border-gray-300'}`}
                          />
                        )}
                        {item.typing && numberLooksWrong && (
                          <p className="text-xs text-red-700">This number doesn't look right. Check it against the photo.</p>
                        )}
                        {open && (choices.length > 0 || (item.typing && fixes.length > 0)) && (
                          <div className="text-xs text-gray-700 space-y-1">
                            <p>Tap the number that matches the photo:</p>
                            <p className="flex flex-wrap gap-1">
                              {(choices.length > 0 ? choices : fixes).map(c => (
                                <button key={c} onClick={() => updateItemTracking(item.id, c, 'picked')}
                                  className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-mono hover:border-teal-400 hover:bg-teal-50">{c}</button>
                              ))}
                            </p>
                          </div>
                        )}
                        {item.reason && <p className="text-xs text-amber-800">{item.reason}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {open && unread && item.file && (
                        <button
                          onClick={() => { clearerPhotoForRef.current = item.id; clearerPhotoInputRef.current?.click(); }}
                          disabled={busy}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <ImagePlus className="w-3.5 h-3.5" /> Use a clearer photo
                        </button>
                      )}
                      {open && !item.done && !item.typing && (
                        <button
                          onClick={() => startTyping(item.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Keyboard className="w-3.5 h-3.5" /> Type number
                        </button>
                      )}
                      {!open && !item.done && (
                        <button
                          onClick={() => { setActiveSlipId(item.id); setOrderSearch(''); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Search className="w-3.5 h-3.5" /> Pick order
                        </button>
                      )}
                      <button
                        onClick={() => dismissReviewItem(item.id)}
                        className="px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                      >
                        Skip
                      </button>
                    </div>

                    {open && !item.done && item.trackingNumber && !unread && renderOrderList((o) => assignReviewItem(item, o), saving)}
                  </div>
                );
              })}
            </div>
          )}

          {reviewQueue.length === 0 && !scannedCode && unlinkedOrders.length === 0 && linkedCount > 0 && (
            <p className="text-sm text-gray-500 text-center py-4">All orders linked — you're done!</p>
          )}

          {linkedCount > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600" /> Linked ({linkedCount})
              </h3>
              <p className="text-[11px] text-gray-500">
                Check the weight and courier cost on each slip and press OK.
                {history.length < CONFIRMED_NEEDED
                  ? ` Cost suggestions start after ${CONFIRMED_NEEDED} confirmed slips (${history.length} so far).`
                  : ` Suggestions come from ${history.length} confirmed slips.`}
              </p>
              {Object.values(linkedDetails).map(({ before: o, dispatchDate }) => {
                const saved = courierSaved[o.id];
                const sug = suggestions[o.id] || {};
                const editing = editingLink?.id === o.id;
                return (
                  <div key={o.id} className="p-2 bg-green-50 rounded text-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span>{o.order_number} · {o.customer_name}</span>
                      <span className="flex items-center gap-1 text-green-700 font-mono text-xs">
                        <CheckCircle className="w-3.5 h-3.5" /> {linkedOrders[o.id]}
                      </span>
                    </div>
                    {editing ? (
                      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-green-200 rounded">
                        <label className="flex items-center gap-1 text-xs text-gray-600">Tracking
                          <input value={editingLink.code} onChange={e => setEditingLink(prev => ({ ...prev, code: e.target.value }))}
                            className="w-32 px-1.5 py-1 border border-gray-300 rounded font-mono text-xs" />
                        </label>
                        <label className="flex items-center gap-1 text-xs text-gray-600">Dispatch date
                          <input type="date" value={editingLink.date} onChange={e => setEditingLink(prev => ({ ...prev, date: e.target.value }))}
                            className="px-1.5 py-1 border border-gray-300 rounded text-xs" />
                        </label>
                        <button onClick={saveLinkEdit} disabled={saving}
                          className="px-2.5 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-50">Save</button>
                        <button onClick={() => setEditingLink(null)} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Dispatched {showDay(String(dispatchDate || '').slice(0, 10))}</span>
                        <button onClick={() => setEditingLink({ id: o.id, code: linkedOrders[o.id], date: String(dispatchDate || '').slice(0, 10) })}
                          className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => undoLink(o.id)} disabled={saving}
                          className="flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                          <Undo2 className="w-3 h-3" /> Undo
                        </button>
                      </div>
                    )}
                    {saved ? (
                      <p className="text-xs text-green-700 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> {saved.weight} kg · ₹{saved.cost}
                        <button onClick={() => setCourierSaved(prev => { const n = { ...prev }; delete n[o.id]; return n; })} className="ml-2 underline text-gray-500">change</button>
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs text-gray-600">Weight
                            <input type="number" inputMode="decimal" step="0.01" min="0" value={courierValue(o.id, 'weight')}
                              onChange={e => setCourierField(o.id, 'weight', e.target.value)}
                              className="w-16 px-1.5 py-1 border border-gray-300 rounded text-sm bg-white" /> kg
                          </label>
                          <label className="flex items-center gap-1 text-xs text-gray-600">Cost ₹
                            <input type="number" inputMode="decimal" step="1" min="0" value={courierValue(o.id, 'cost')}
                              onChange={e => setCourierField(o.id, 'cost', e.target.value)}
                              className="w-16 px-1.5 py-1 border border-gray-300 rounded text-sm bg-white" />
                          </label>
                          <button onClick={() => saveCourier(o)}
                            className="ml-auto px-2.5 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700">OK</button>
                        </div>
                        {(sug.weightFrom || sug.costFrom) && (
                          <p className="text-[11px] text-gray-500">
                            {[sug.weightFrom && `Weight from ${sug.weightFrom}`, sug.costFrom && `cost from ${sug.costFrom}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-200">
            {scanning && !scannedCode && (
              <button onClick={stopScanner} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                Stop Camera
              </button>
            )}
            <button onClick={handleFinish} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
              Done ({linkedCount} linked)
            </button>
          </div>
        </div>
      </div>

      {zoomedUrl && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 z-[60] flex items-center justify-center p-4"
          onClick={() => setZoomedUrl(null)}
        >
          <img src={zoomedUrl} alt="Slip, full size" className="max-w-full max-h-full rounded-lg" />
          <button onClick={() => setZoomedUrl(null)} className="absolute top-4 right-4 text-white bg-black bg-opacity-40 rounded-full p-2">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
