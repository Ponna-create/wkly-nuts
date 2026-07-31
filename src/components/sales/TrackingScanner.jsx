import React, { useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Image as ImageIcon, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';
import { findBestOrderMatch } from '../../utils/ocrMatch';

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Scans the printed CONSIGNMENT NUMBER barcode straight off a courier's
// paper slip (ST Courier etc.) instead of typing it in by hand. The
// customer name on the slip is handwritten and too messy to read reliably,
// so matching to the right order is a tap, not a guess.
export default function TrackingScanner({ orders, onClose, onUpdate }) {
  const { showToast, dispatch } = useApp();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scannedCode, setScannedCode] = useState(null);
  const [linkedOrders, setLinkedOrders] = useState({}); // orderId -> tracking number
  const [saving, setSaving] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null); // { order, confidence, matchedVia, trackingNumber }
  const [queueProgress, setQueueProgress] = useState(null); // { current, total } while working through a multi-photo upload
  const html5QrCodeRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const processingRef = useRef(false);
  const fileInputRef = useRef(null);
  const aiFileInputRef = useRef(null);
  const queueRef = useRef({ files: [], mode: null }); // remaining files in a multi-photo upload

  const unlinkedOrders = orders.filter(o => !linkedOrders[o.id]);

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

  const applyDecodedCode = (rawText) => {
    const code = rawText.trim();
    const alreadyLinked = Object.values(linkedOrders).includes(code);
    if (alreadyLinked) {
      showToast('This slip is already linked to an order', 'error');
      if (queueRef.current.files.length > 0 || queueProgress) advanceQueue();
      return;
    }
    setScannedCode(code);
  };

  const onScanSuccess = (decodedText) => {
    const now = Date.now();
    if (now - lastScanTimeRef.current < 2000) return;
    if (processingRef.current) return;
    lastScanTimeRef.current = now;
    applyDecodedCode(decodedText);
  };

  // Reading an already-taken photo (gallery, photocopy scan, etc.) instead
  // of live-scanning the physical slip — same barcode decoder, just fed a
  // still image rather than a camera stream. Multiple files selected at
  // once are processed one at a time via the queue below, so a whole
  // day's stack of slip photos can go in one pick.
  const handleFileSelected = (e) => {
    const files = e.target.files;
    e.target.value = ''; // allow picking the same file(s) again later
    if (!files || files.length === 0) return;
    startQueue(files, 'barcode');
  };

  const processBarcodeFile = async (file) => {
    setError(null);
    setReadingFile(true);
    if (scanning) await stopScanner();
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('tracking-scan-reader');
      }
      const decodedText = await html5QrCodeRef.current.scanFile(file, false);
      applyDecodedCode(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      if (queueRef.current.files.length > 0 || queueProgress) {
        showToast("Couldn't find a barcode in one photo — skipped it", 'error');
        advanceQueue();
      } else {
        setError("Couldn't find a barcode in that photo — try a clearer/closer photo, or scan live.");
      }
    } finally {
      setReadingFile(false);
    }
  };

  // Drives both upload paths through a shared queue so a batch of photos
  // (picked all at once) gets processed one at a time — each one still
  // pauses on the same confirm/pick-order step as a single upload, so
  // nothing gets linked without her tapping it.
  const startQueue = (fileList, mode) => {
    const files = Array.from(fileList);
    queueRef.current = { files, mode };
    setQueueProgress({ current: 1, total: files.length });
    advanceQueue();
  };

  const advanceQueue = () => {
    const { files, mode } = queueRef.current;
    if (files.length === 0) {
      queueRef.current = { files: [], mode: null };
      setQueueProgress(null);
      return;
    }
    const [file, ...rest] = files;
    queueRef.current = { files: rest, mode };
    setQueueProgress(prev => (prev ? { current: prev.total - rest.length, total: prev.total } : null));
    if (mode === 'barcode') processBarcodeFile(file);
    else processAiFile(file);
  };

  const linkOrder = async (order, code) => {
    if (!code || saving) return;
    setSaving(true);
    const updatedOrder = {
      id: order.id,
      trackingNumber: code,
      courierName: order.courier_name || 'ST Courier',
      status: 'dispatched',
      dispatchDate: order.dispatch_date || new Date().toISOString().split('T')[0],
    };
    const { error } = await dbService.updateSalesOrder(updatedOrder);
    setSaving(false);
    if (error) {
      showToast('Error saving tracking number', 'error');
      return;
    }
    // Keep shared app state in sync too — this scanner is opened from more
    // than one page (Sales Orders, Quick Order), and not every caller does
    // its own full reload afterward.
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
    setLinkedOrders(prev => ({ ...prev, [order.id]: code }));
    setScannedCode(null);
    setAiSuggestion(null);
    showToast(`${order.order_number} → ${code}`, 'success');
    // Mid-batch — move straight to the next photo instead of waiting on her
    // to tap an upload button again.
    if (queueRef.current.files.length > 0 || queueProgress) advanceQueue();
  };

  const handlePickOrder = (order) => linkOrder(order, scannedCode);

  // AI photo read (Google Cloud Vision OCR, server-side) — reads whatever
  // text is on the slip and guesses the order via phone number (high
  // confidence) or a fuzzy name match (shown as a suggestion, never
  // auto-committed — she still taps Confirm). Multiple files at once run
  // through the same queue as the barcode upload above.
  const handleAiFileSelected = (e) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;
    startQueue(files, 'ai');
  };

  const processAiFile = async (file) => {
    setError(null);
    setAiSuggestion(null);
    setOcrLoading(true);
    if (scanning) await stopScanner();

    const inBatch = queueRef.current.files.length > 0 || queueProgress;
    const skip = (msg) => {
      if (inBatch) { showToast(msg, 'error'); advanceQueue(); }
      else setError(msg);
    };

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/scan-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) {
        skip("Couldn't read any text in one photo — skipped");
        return;
      }

      const match = findBestOrderMatch(data.text, unlinkedOrders);
      if (!match.trackingNumber) {
        skip('No tracking number found in one photo — skipped');
        return;
      }
      if (!match.order) {
        // Got a tracking number but no confident order match — fall through
        // to the normal manual picker with this number pre-filled.
        applyDecodedCode(match.trackingNumber);
        return;
      }
      setAiSuggestion(match);
    } catch (err) {
      console.error('AI scan error:', err);
      skip('AI read failed for one photo — skipped');
    } finally {
      setOcrLoading(false);
    }
  };

  const linkedCount = Object.keys(linkedOrders).length;

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
            <p className="text-sm text-gray-500 mt-1">{linkedCount} linked · {unlinkedOrders.length} order{unlinkedOrders.length !== 1 ? 's' : ''} left</p>
          </div>
          <button onClick={handleFinish} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {queueProgress && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm text-blue-700 font-medium">
              Processing photo {queueProgress.current} of {queueProgress.total}
            </div>
          )}

          {!scannedCode && !aiSuggestion && (
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '220px' }}>
              <div id="tracking-scan-reader" className="w-full" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
                  <button onClick={startScanner} disabled={readingFile || ocrLoading}
                    className="flex items-center gap-3 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-lg disabled:opacity-50">
                    <Camera className="w-6 h-6" /> Start Camera
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={readingFile || ocrLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm disabled:opacity-50">
                    <ImageIcon className="w-4 h-4" /> {readingFile ? 'Reading photo...' : 'Upload Photos (barcode)'}
                  </button>
                  <button onClick={() => aiFileInputRef.current?.click()} disabled={readingFile || ocrLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 rounded-lg hover:bg-fuchsia-100 font-medium text-sm disabled:opacity-50">
                    <ImageIcon className="w-4 h-4" /> {ocrLoading ? 'Reading photo...' : 'Upload Photos (full slip)'}
                  </button>
                  <p className="text-xs text-gray-400">Tip: select multiple photos at once to go through a whole stack</p>
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

          {aiSuggestion && (
            <div className="space-y-3">
              <div className="p-3 bg-fuchsia-50 border border-fuchsia-200 rounded-lg">
                <p className="text-xs text-fuchsia-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> SUGGESTED MATCH
                  {aiSuggestion.matchedVia === 'phone' && ' — matched by phone number'}
                  {aiSuggestion.matchedVia === 'name' && ` — ${Math.round(aiSuggestion.confidence * 100)}% name match`}
                </p>
                <p className="text-lg font-bold text-fuchsia-900 mt-1">{aiSuggestion.order.customer_name}</p>
                <p className="text-xs text-gray-600">{aiSuggestion.order.order_number} · {aiSuggestion.order.shipping_address?.slice(0, 50) || ''}</p>
                <p className="text-sm font-mono text-gray-700 mt-1">Tracking: {aiSuggestion.trackingNumber}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => linkOrder(aiSuggestion.order, aiSuggestion.trackingNumber)}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" /> Confirm — this is correct
                </button>
                <button
                  onClick={() => { applyDecodedCode(aiSuggestion.trackingNumber); setAiSuggestion(null); }}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 text-sm"
                >
                  Not this one
                </button>
              </div>
            </div>
          )}

          {scannedCode ? (
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
                onClick={() => {
                  setScannedCode(null);
                  if (queueRef.current.files.length > 0 || queueProgress) advanceQueue();
                }}
                className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-300"
              >
                {queueProgress ? 'Skip this photo' : 'Rescan this slip'}
              </button>
            </div>
          ) : (
            unlinkedOrders.length === 0 && linkedCount > 0 && (
              <p className="text-sm text-gray-500 text-center py-4">All orders linked — you're done!</p>
            )
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
