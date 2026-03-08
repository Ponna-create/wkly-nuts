import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CheckCircle, AlertCircle, Ban, Package } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';

// Statuses that mean order is already dispatched or beyond
const ALREADY_DISPATCHED = ['dispatched', 'in_transit', 'delivered', 'completed'];

export default function QRScanner({ onClose, onScanComplete }) {
  const { showToast } = useApp();
  const [scanning, setScanning] = useState(false);
  const [scannedOrders, setScannedOrders] = useState([]);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // ── Dedup & locking refs ──
  const scannedIdsRef = useRef(new Set());
  const processingRef = useRef(false);
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const startScanner = async () => {
    try {
      setError(null);
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 2,            // Reduced from 10 → 2 to avoid rapid-fire
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
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

  const onScanSuccess = async (decodedText) => {
    // ── GATE 1: 3-second cooldown ──
    const now = Date.now();
    if (now - lastScanTimeRef.current < 3000) return;

    // ── GATE 2: Processing lock ──
    if (processingRef.current) return;

    // Parse QR data
    let data;
    try {
      data = JSON.parse(decodedText);
    } catch {
      setError('Invalid QR code format');
      return;
    }

    if (!data.id || !data.orderNumber) {
      setError('Invalid QR code - not a WKLY Nuts order');
      return;
    }

    // ── GATE 3: Client-side dedup ──
    if (scannedIdsRef.current.has(data.id)) {
      setLastScan({ ...data, status: 'duplicate', message: 'Already scanned in this session' });
      lastScanTimeRef.current = now;
      return;
    }

    // Lock everything
    processingRef.current = true;
    lastScanTimeRef.current = now;
    scannedIdsRef.current.add(data.id);

    try {
      // ── GATE 4: SERVER-SIDE CHECK — fetch order from DB ──
      const { data: dbOrder, error: fetchError } = await dbService.getSalesOrderById(data.id);

      if (fetchError || !dbOrder) {
        scannedIdsRef.current.delete(data.id);
        setLastScan({ ...data, status: 'error', message: 'Order not found in database' });
        showToast(`Order ${data.orderNumber} not found`, 'error');
        return;
      }

      // Check if already dispatched or beyond
      if (ALREADY_DISPATCHED.includes(dbOrder.status)) {
        setLastScan({
          ...data,
          status: 'already_dispatched',
          message: `Already ${dbOrder.status.replace('_', ' ')} — no action taken`,
        });
        showToast(`${data.orderNumber} is already ${dbOrder.status.replace('_', ' ')}`, 'error');
        return;
      }

      // ── SAFE TO DISPATCH — update order ──
      const { error: updateError } = await dbService.updateSalesOrder({
        id: data.id,
        status: 'dispatched',
        dispatch_date: new Date().toISOString().split('T')[0],
      });

      if (updateError) {
        scannedIdsRef.current.delete(data.id);
        setLastScan({ ...data, status: 'error', message: updateError.message });
        showToast(`Error updating ${data.orderNumber}`, 'error');
        return;
      }

      // Success!
      setLastScan({ ...data, status: 'success', previousStatus: dbOrder.status });
      setScannedOrders(prev => [...prev, { ...data, scannedAt: new Date(), previousStatus: dbOrder.status }]);
      showToast(`✓ ${data.orderNumber} → Dispatched!`, 'success');

      // Deduct inventory (non-blocking, don't fail the scan)
      try {
        const orderItems = dbOrder.items || data.items || [];
        if (orderItems.length > 0) {
          const invResult = await dbService.deductInventoryForOrder({ id: data.id, items: orderItems });
          if (invResult?.warnings?.length > 0) {
            showToast(`Stock: ${invResult.warnings[0]}`, 'error');
          }
        }
      } catch (invErr) {
        console.warn('Inventory deduction warning:', invErr);
      }

    } catch (err) {
      scannedIdsRef.current.delete(data.id);
      setLastScan({ ...data, status: 'error', message: err.message || 'Unknown error' });
      console.error('Scan processing error:', err);
    } finally {
      processingRef.current = false;
    }
  };

  const handleFinish = () => {
    stopScanner();
    if (onScanComplete) onScanComplete(scannedOrders);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Scan for Dispatch</h2>
            <p className="text-sm text-gray-500 mt-1">
              {scannedOrders.length} order{scannedOrders.length !== 1 ? 's' : ''} dispatched
            </p>
          </div>
          <button onClick={handleFinish} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Camera View */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '280px' }}>
            <div id="qr-reader" ref={scannerRef} className="w-full" />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <button onClick={startScanner}
                  className="flex items-center gap-3 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-lg">
                  <Camera className="w-6 h-6" /> Start Camera
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Last Scan Result */}
          {lastScan && (
            <div className={`p-3 rounded-lg flex items-center gap-2 ${
              lastScan.status === 'success' ? 'bg-green-50 border border-green-200' :
              lastScan.status === 'already_dispatched' ? 'bg-blue-50 border border-blue-200' :
              lastScan.status === 'duplicate' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              {lastScan.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : lastScan.status === 'already_dispatched' ? (
                <Ban className="w-5 h-5 text-blue-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {lastScan.orderNumber} - {lastScan.customer}
                </p>
                <p className="text-xs text-gray-600">
                  {lastScan.status === 'success'
                    ? `✓ Dispatched! (was: ${(lastScan.previousStatus || 'unknown').replace('_', ' ')})`
                    : lastScan.message || 'Error'}
                </p>
              </div>
            </div>
          )}

          {/* Scanned Orders List */}
          {scannedOrders.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-green-600" />
                Dispatched Orders ({scannedOrders.length})
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {scannedOrders.map((order, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <div>
                      <span className="font-medium text-sm">{order.orderNumber}</span>
                      <span className="text-xs text-gray-500 ml-2">{order.customer}</span>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            {scanning && (
              <button onClick={stopScanner}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
                Stop Camera
              </button>
            )}
            <button onClick={handleFinish}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
              Done ({scannedOrders.length} dispatched)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
