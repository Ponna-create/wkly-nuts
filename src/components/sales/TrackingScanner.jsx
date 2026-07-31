import React, { useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Image as ImageIcon, CheckCircle, AlertCircle, Package } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';

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
  const html5QrCodeRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const processingRef = useRef(false);
  const fileInputRef = useRef(null);

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
  // still image rather than a camera stream.
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;

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
      setError("Couldn't find a barcode in that photo — try a clearer/closer photo, or scan live.");
    } finally {
      setReadingFile(false);
    }
  };

  const handlePickOrder = async (order) => {
    if (!scannedCode || saving) return;
    setSaving(true);
    const updatedOrder = {
      id: order.id,
      trackingNumber: scannedCode,
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
        tracking_number: scannedCode,
        courier_name: updatedOrder.courierName,
        status: 'dispatched',
        dispatch_date: updatedOrder.dispatchDate,
      },
    });
    setLinkedOrders(prev => ({ ...prev, [order.id]: scannedCode }));
    setScannedCode(null);
    showToast(`${order.order_number} → ${scannedCode}`, 'success');
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
          {!scannedCode && (
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '220px' }}>
              <div id="tracking-scan-reader" className="w-full" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
                  <button onClick={startScanner} disabled={readingFile}
                    className="flex items-center gap-3 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-lg disabled:opacity-50">
                    <Camera className="w-6 h-6" /> Start Camera
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={readingFile}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 font-medium text-sm disabled:opacity-50">
                    <ImageIcon className="w-4 h-4" /> {readingFile ? 'Reading photo...' : 'Upload Photo'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelected}
                    className="hidden"
                  />
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
                onClick={() => setScannedCode(null)}
                className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-300"
              >
                Rescan this slip
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
