import React, { useState, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Image as ImageIcon, CheckCircle, AlertCircle, Package, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';
import { findBestOrderMatch } from '../../utils/ocrMatch';

// Only resize/recompress when the file is actually large enough to risk
// Vercel's ~4.5MB request-body limit (base64 inflates size ~33% on top of
// the original). A photo already under that just gets sent as-is — every
// canvas round-trip is a fresh generation of JPEG compression loss on top
// of whatever the phone's camera already applied, and re-encoding a file
// that didn't need it at all was hurting real, already-fine photos for no
// reason. Only touch it when there's an actual size problem to solve.
const SIZE_THRESHOLD_BYTES = 3 * 1024 * 1024; // 3MB — leaves headroom under the ~4.5MB body limit even after base64 inflation
const MAX_DIMENSION = 2400;
const readRaw = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  if (file.size <= SIZE_THRESHOLD_BYTES) {
    readRaw(file).then(resolve).catch(reject);
    return;
  }
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(objectUrl);
    let { width, height } = img;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    resolve(canvas.toDataURL('image/jpeg', 0.92));
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    // Fall back to the raw file rather than failing outright — some formats
    // (e.g. HEIC) can't be drawn to a canvas in every browser.
    readRaw(file).then(resolve).catch(reject);
  };
  img.src = objectUrl;
});

let reviewIdCounter = 0;
const nextReviewId = () => `rv-${Date.now()}-${reviewIdCounter++}`;

// Upload a whole stack of courier slip photos and it should feel like
// dropping a pile of paper on the desk and having it sort itself — every
// photo gets OCR'd and matched in the background with no pausing per
// photo, confident matches (phone number, or a name backed by the order's
// own pincode showing up on the slip) link themselves straight away, and
// only the genuinely unclear ones (bad handwriting, no match found) land
// in a "Needs Your Check" list at the end for a quick manual pick.
export default function TrackingScanner({ orders, onClose, onUpdate }) {
  const { state, showToast, dispatch } = useApp();
  const skus = state.skus || [];
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scannedCode, setScannedCode] = useState(null); // live camera single-scan only
  const [linkedOrders, setLinkedOrders] = useState({}); // orderId -> tracking number
  const [saving, setSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null); // { current, total } while a photo batch runs
  const [reviewQueue, setReviewQueue] = useState([]); // items that need a manual pick after the batch
  const [pickerOpenFor, setPickerOpenFor] = useState(null); // review item id whose "assign manually" search is open
  const [pickerSearch, setPickerSearch] = useState('');
  const html5QrCodeRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const processingRef = useRef(false);
  const fileInputRef = useRef(null);
  const aiFileInputRef = useRef(null);

  const unlinkedOrders = useMemo(() => orders.filter(o => !linkedOrders[o.id]), [orders, linkedOrders]);
  const linkedCount = Object.keys(linkedOrders).length;
  const busy = batchProgress != null;

  const startScanner = async () => {
    try {
      setError(null);
      const html5QrCode = new Html5Qrcode('tracking-scan-reader');
      html5QrCodeRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 5, qrbox: { width: 280, height: 120 } },
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
    setScannedCode(decodedText.trim());
  };

  // One physical consignment slip = one shipment, so the same tracking
  // number can never legitimately belong to two orders. Nothing previously
  // checked for this — a re-scan (or two orders that happen to share a
  // first name) could silently attach the same tracking number to a second
  // order on top of whoever already had it, with no warning either time.
  const findDuplicateTrackingOrder = (code, excludeOrderId) =>
    orders.find(o => o.tracking_number === code && String(o.id) !== String(excludeOrderId));

  // Saves the tracking number onto an order. Returns true/false so batch
  // processing can decide whether to move on or fall back to the review
  // list. Pure side-effect function — no queue/UI logic in here.
  const doLink = async (order, code, extracted = {}) => {
    const duplicate = findDuplicateTrackingOrder(code, order.id);
    if (duplicate) {
      showToast(`Tracking ${code} is already on ${duplicate.order_number} (${duplicate.customer_name}) — not linking it to a second order`, 'error');
      return false;
    }
    const updatedOrder = {
      id: order.id,
      trackingNumber: code,
      courierName: order.courier_name || 'ST Courier',
      status: 'dispatched',
      dispatchDate: order.dispatch_date || new Date().toISOString().split('T')[0],
      ...(extracted.weight != null && { shippingWeight: extracted.weight }),
      ...(extracted.amount != null && { courierAmount: extracted.amount }),
      ...(extracted.slipDate && { courierSlipDate: extracted.slipDate }),
    };
    const { error } = await dbService.updateSalesOrder(updatedOrder);
    if (error) return false;

    dispatch({
      type: 'UPDATE_SALES_ORDER',
      payload: {
        ...order,
        tracking_number: code,
        courier_name: updatedOrder.courierName,
        status: 'dispatched',
        dispatch_date: updatedOrder.dispatchDate,
        ...(updatedOrder.shippingWeight != null && { shipping_weight: updatedOrder.shippingWeight }),
        ...(updatedOrder.courierAmount != null && { courier_amount: updatedOrder.courierAmount }),
        ...(updatedOrder.courierSlipDate && { courier_slip_date: updatedOrder.courierSlipDate }),
      },
    });
    setLinkedOrders(prev => ({ ...prev, [order.id]: code }));
    return true;
  };

  // Single live-camera scan — still a one-at-a-time interactive flow (she's
  // holding the slip under the camera), so it keeps the old scan → pick UI.
  const handlePickOrder = async (order) => {
    if (!scannedCode || saving) return;
    setSaving(true);
    const ok = await doLink(order, scannedCode);
    setSaving(false);
    if (!ok) { showToast('Error saving tracking number', 'error'); return; }
    showToast(`${order.order_number} → ${scannedCode}`, 'success');
    setScannedCode(null);
  };

  // Barcode-only upload: decodes the consignment number but there's no name
  // on it to match against, so every file here always needs a manual pick —
  // it still runs the whole batch without pausing, then queues them all up.
  const handleFileSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    if (scanning) await stopScanner();

    setBatchProgress({ current: 0, total: files.length });
    const newReview = [];
    for (let i = 0; i < files.length; i++) {
      setBatchProgress({ current: i + 1, total: files.length });
      if (!html5QrCodeRef.current) html5QrCodeRef.current = new Html5Qrcode('tracking-scan-reader');
      try {
        const decodedText = await html5QrCodeRef.current.scanFile(files[i], false);
        const code = decodedText.trim();
        const { data: logRow } = await dbService.logAiScan({ trackingNumber: code, outcome: 'pending_review' });
        newReview.push({ id: nextReviewId(), logId: logRow?.id, trackingNumber: code, order: null, reason: 'Barcode only — no name on it, pick the order' });
      } catch {
        dbService.logAiScan({ outcome: 'failed' });
        newReview.push({ id: nextReviewId(), trackingNumber: null, order: null, reason: "Couldn't find a barcode in this photo" });
      }
    }
    setBatchProgress(null);
    setReviewQueue(prev => [...prev, ...newReview]);
    showToast(`${newReview.length} photo${newReview.length !== 1 ? 's' : ''} added to Needs Your Check`, 'success');
  };

  // The magic path: reads the whole slip (Google Cloud Vision OCR,
  // server-side), matches by phone or a pincode-boosted name match, and
  // auto-links anything confident without stopping. Runs the entire batch
  // straight through — only what's left over after all photos are read
  // shows up for her to check.
  const handleAiFileSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    if (scanning) await stopScanner();

    setError(null);
    setBatchProgress({ current: 0, total: files.length });

    // Phase 1: read every photo with Gemini, 2 at a time. This is the slow
    // part (a few seconds of actual model "thinking" per photo, plus the
    // free tier's own 10-requests/minute cap) — running them one at a time
    // wasted that budget. 2 concurrent stays safely under the cap without
    // tripping 429s on a normal-sized batch. Kept as a separate pass from
    // matching/linking below so two photos in flight at once can never both
    // grab the same order — that part stays strictly sequential.
    const ocrResults = new Array(files.length);
    let completed = 0;
    // Sequential, not concurrent — the free Gemini tier's own per-minute cap
    // is easy to trip with 2 requests in flight plus retries stacked on top,
    // and that self-inflicted overload was showing up as opaque 502s rather
    // than a clean 429. One at a time is slower but far more reliable, and
    // batches here are small enough that it doesn't meaningfully cost time.
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const readOne = async (i) => {
      let lastResult;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const base64 = await fileToBase64(files[i]);
          const res = await fetch('/api/scan-slip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 }),
          });
          const data = await res.json();
          lastResult = { ok: res.ok, status: res.status, data };
        } catch (err) {
          lastResult = { ok: false, networkError: err?.message || 'Network error' };
        }
        if (lastResult.ok || lastResult.status === 429 || lastResult.status === 400) break; // don't retry a rate-limit or a request Gemini actively rejected
        if (attempt < 2) await sleep(3000 * (attempt + 1)); // 3s, then 6s — long enough for a per-minute quota to actually recover
      }
      ocrResults[i] = lastResult;
      completed++;
      setBatchProgress({ current: completed, total: files.length });
    };
    for (let i = 0; i < files.length; i++) await readOne(i);

    // Phase 2: match + link in original order, sequentially and fast (no
    // more waiting on Gemini here).
    const linkedIds = new Set(Object.keys(linkedOrders));
    const newReview = [];
    let autoLinked = 0;

    for (let i = 0; i < files.length; i++) {
      const result = ocrResults[i];
      if (!result || !result.ok) {
        const detail = result?.data?.geminiDetail;
        const reason = result?.status === 429
          ? "Rate limited — wait a minute and re-upload this one"
          : result?.networkError
            ? `Upload failed (${result.networkError}) — try again, or a smaller photo`
            : result?.status
              ? `Server error (${result.status})${detail ? `: ${detail}` : ''} — retried 3x, still failing`
              : "Couldn't read anything in this photo";
        dbService.logAiScan({ outcome: 'failed' });
        newReview.push({ id: nextReviewId(), trackingNumber: null, order: null, reason });
        continue;
      }
      const data = result.data;
      if (!data.trackingNumber && !data.customerName && !data.rawText) {
        dbService.logAiScan({ outcome: 'failed' });
        const reason = data.emptyReason ? `Nothing readable (${data.emptyReason})` : "Couldn't read anything in this photo";
        newReview.push({ id: nextReviewId(), trackingNumber: null, order: null, reason });
        continue;
      }

      const pool = orders.filter(o => !linkedIds.has(String(o.id)));
      const match = findBestOrderMatch(data, pool, skus);

      if (!match.trackingNumber) {
        dbService.logAiScan({ outcome: 'failed', guessedName: match.guessedName });
        newReview.push({ id: nextReviewId(), trackingNumber: null, order: null, guessedName: match.guessedName, reason: 'No tracking number found in this photo' });
        continue;
      }

      if (match.order && (match.matchedVia === 'phone' || match.confidence >= 0.85)) {
        const dup = findDuplicateTrackingOrder(match.trackingNumber, match.order.id);
        if (dup) {
          dbService.logAiScan({ outcome: 'failed', orderId: match.order.id, trackingNumber: match.trackingNumber, guessedName: match.guessedName });
          newReview.push({ id: nextReviewId(), trackingNumber: match.trackingNumber, order: match.order, ...match, reason: `Tracking already on ${dup.order_number} (${dup.customer_name}) — pick the right one manually` });
          continue;
        }
        linkedIds.add(String(match.order.id)); // reserve before the await so nothing else in this batch can grab the same order
        const ok = await doLink(match.order, match.trackingNumber, match);
        if (ok) {
          autoLinked++;
          dbService.logAiScan({ outcome: 'auto_linked', orderId: match.order.id, orderNumber: match.order.order_number, trackingNumber: match.trackingNumber, matchedVia: match.matchedVia, confidence: match.confidence, guessedName: match.guessedName });
        } else {
          linkedIds.delete(String(match.order.id));
          const { data: logRow } = await dbService.logAiScan({ orderId: match.order.id, orderNumber: match.order.order_number, trackingNumber: match.trackingNumber, matchedVia: match.matchedVia, confidence: match.confidence, guessedName: match.guessedName, outcome: 'pending_review' });
          newReview.push({ id: nextReviewId(), logId: logRow?.id, trackingNumber: match.trackingNumber, order: match.order, ...match, reason: 'Matched but saving failed — try confirming again' });
        }
        continue;
      }

      // Medium/low confidence — surface exactly what it read so she can
      // tell at a glance whether it's bad handwriting or a genuine no-match.
      const reason = match.order
        ? `${Math.round(match.confidence * 100)}% name match — please confirm`
        : match.guessedName
          ? `Couldn't confidently match "${match.guessedName}" — check the handwriting`
          : "Couldn't read a name on this slip — pick manually";
      const { data: logRow } = await dbService.logAiScan({ orderId: match.order?.id, orderNumber: match.order?.order_number, trackingNumber: match.trackingNumber, matchedVia: match.matchedVia, confidence: match.confidence, guessedName: match.guessedName, outcome: 'pending_review' });
      newReview.push({ id: nextReviewId(), logId: logRow?.id, trackingNumber: match.trackingNumber, order: match.order, confidence: match.confidence, matchedVia: match.matchedVia, guessedName: match.guessedName, weight: match.weight, amount: match.amount, slipDate: match.slipDate, reason });
    }

    setBatchProgress(null);
    setReviewQueue(prev => [...prev, ...newReview]);
    showToast(
      `${autoLinked} linked automatically${newReview.length ? `, ${newReview.length} need a quick check` : ''}`,
      'success'
    );
  };

  const confirmReviewItem = async (item) => {
    if (!item.order || !item.trackingNumber || saving) return;
    setSaving(true);
    const ok = await doLink(item.order, item.trackingNumber, item);
    setSaving(false);
    if (!ok) { showToast('Error saving tracking number', 'error'); return; }
    if (item.logId) dbService.resolveAiScan(item.logId, { outcome: 'user_confirmed', orderId: item.order.id, orderNumber: item.order.order_number });
    showToast(`${item.order.order_number} → ${item.trackingNumber}`, 'success');
    setReviewQueue(prev => prev.filter(r => r.id !== item.id));
  };

  const assignReviewItem = async (item, order) => {
    if (!item.trackingNumber || saving) return;
    setSaving(true);
    const ok = await doLink(order, item.trackingNumber, item);
    setSaving(false);
    if (!ok) { showToast('Error saving tracking number', 'error'); return; }
    // If it already had a suggested order and she picked someone else,
    // that's the AI guessing wrong — distinct from picking from scratch
    // (barcode-only, or no name match at all) for accuracy tracking.
    if (item.logId) dbService.resolveAiScan(item.logId, { outcome: item.order ? 'user_reassigned' : 'user_assigned', orderId: order.id, orderNumber: order.order_number });
    showToast(`${order.order_number} → ${item.trackingNumber}`, 'success');
    setReviewQueue(prev => prev.filter(r => r.id !== item.id));
    setPickerOpenFor(null);
    setPickerSearch('');
  };

  const dismissReviewItem = (id) => {
    setReviewQueue(prev => {
      const item = prev.find(r => r.id === id);
      if (item?.logId) dbService.resolveAiScan(item.logId, { outcome: 'skipped' });
      return prev.filter(r => r.id !== id);
    });
  };

  const pickerResults = useMemo(() => {
    if (!pickerOpenFor) return [];
    const q = pickerSearch.trim().toLowerCase();
    const pool = unlinkedOrders;
    if (!q) return pool.slice(0, 8);
    return pool.filter(o =>
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.order_number || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [pickerOpenFor, pickerSearch, unlinkedOrders]);

  const handleFinish = async () => {
    await stopScanner();
    if (linkedCount > 0) onUpdate();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Scan Tracking Slips</h2>
            <p className="text-sm text-gray-500 mt-1">
              {linkedCount} linked{reviewQueue.length > 0 ? ` · ${reviewQueue.length} need a check` : ''} · {unlinkedOrders.length} order{unlinkedOrders.length !== 1 ? 's' : ''} left
            </p>
          </div>
          <button onClick={handleFinish} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
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
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '220px' }}>
              <div id="tracking-scan-reader" className="w-full" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
                  <button onClick={startScanner} disabled={busy}
                    className="flex items-center gap-3 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-lg disabled:opacity-50">
                    <Camera className="w-6 h-6" /> Start Camera
                  </button>
                  <button onClick={() => aiFileInputRef.current?.click()} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 font-medium text-sm disabled:opacity-50">
                    <ImageIcon className="w-4 h-4" /> {busy ? 'Reading photos...' : 'Upload Photos (full slip — auto-matches)'}
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm disabled:opacity-50">
                    <ImageIcon className="w-4 h-4" /> {busy ? 'Reading photos...' : 'Upload Photos (barcode only)'}
                  </button>
                  <p className="text-xs text-gray-400">Select the whole stack at once — it reads all of them, then only asks about the ones it's unsure of</p>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelected} className="hidden" />
                  <input ref={aiFileInputRef} type="file" accept="image/*" multiple onChange={handleAiFileSelected} className="hidden" />
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
              {unlinkedOrders.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No unlinked orders left</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {unlinkedOrders.map(order => (
                    <button
                      key={order.id}
                      onClick={() => handlePickOrder(order)}
                      disabled={saving}
                      className="w-full text-left p-2.5 border border-gray-200 rounded-lg hover:border-teal-400 hover:bg-teal-50 transition disabled:opacity-50"
                    >
                      <p className="font-medium text-sm text-gray-900">{order.customer_name}</p>
                      <p className="text-xs text-gray-500">{order.order_number} · {order.shipping_address?.slice(0, 50) || ''}</p>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setScannedCode(null)}
                className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-300"
              >
                Rescan this slip
              </button>
            </div>
          )}

          {reviewQueue.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Needs Your Check ({reviewQueue.length})
              </h3>
              {reviewQueue.map(item => (
                <div key={item.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  {item.trackingNumber && (
                    <p className="text-xs font-mono text-gray-600">Tracking: {item.trackingNumber}</p>
                  )}
                  <p className="text-sm text-amber-800">{item.reason}</p>

                  {item.order && (
                    <div className="p-2 bg-white border border-amber-200 rounded">
                      <p className="text-sm font-semibold text-gray-900">{item.order.customer_name}</p>
                      <p className="text-xs text-gray-500">{item.order.order_number} · {item.order.shipping_address?.slice(0, 50) || ''}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {item.order && item.trackingNumber && (
                      <button
                        onClick={() => confirmReviewItem(item)}
                        disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                    )}
                    {item.trackingNumber && (
                      <button
                        onClick={() => { setPickerOpenFor(pickerOpenFor === item.id ? null : item.id); setPickerSearch(''); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Search className="w-3.5 h-3.5" /> {item.order ? 'Not this one' : 'Pick order'}
                      </button>
                    )}
                    <button
                      onClick={() => dismissReviewItem(item.id)}
                      className="px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                    >
                      Skip
                    </button>
                  </div>

                  {pickerOpenFor === item.id && (
                    <div className="pt-1 space-y-1.5">
                      <input
                        autoFocus
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Search customer or order #..."
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {pickerResults.map(o => (
                          <button
                            key={o.id}
                            onClick={() => assignReviewItem(item, o)}
                            disabled={saving}
                            className="w-full text-left px-2 py-1.5 border border-gray-200 rounded hover:border-teal-400 hover:bg-teal-50 text-sm disabled:opacity-50"
                          >
                            <span className="font-medium text-gray-900">{o.customer_name}</span>
                            <span className="text-xs text-gray-500 ml-1.5">{o.order_number}</span>
                          </button>
                        ))}
                        {pickerResults.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">No matching orders</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
              {orders.filter(o => linkedOrders[o.id]).map(o => (
                <div key={o.id} className="flex items-center justify-between p-2 bg-green-50 rounded text-sm">
                  <span>{o.order_number} · {o.customer_name}</span>
                  <span className="flex items-center gap-1 text-green-700 font-mono text-xs">
                    <CheckCircle className="w-3.5 h-3.5" /> {linkedOrders[o.id]}
                  </span>
                </div>
              ))}
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
    </div>
  );
}
