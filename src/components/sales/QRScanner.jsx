import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';

export default function QRScanner({ onClose, onScanComplete }) {
  const { showToast } = useApp();
  const [scanning, setScanning] = useState(false);
  const [scannedOrders, setScannedOrders] = useState([]);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const scannedIdsRef = useRef(new Set()); // Ref-based dedup (instant, no async delay)
  const processingRef = useRef(false); // Lock to prevent concurrent scans
  const lastScanTimeRef = useRef(0); // Cooldown timer

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setError(null);
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        onScanSuccess,
        () => {} // ignore scan failures (no QR in frame)
      );

      setScanning(true);
    } catch (err) {
      console.error('Scanner error:', err);
      setError('Could not access camera. Please allow camera permission.');
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && scanning) {
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
    // Cooldown: ignore scans within 2 seconds of last scan
    const now = Date.now();
    if (now - lastScanTimeRef.current < 2000) return;

    // Prevent concurrent processing
    if (processingRef.current) return;

    try {
      const data = JSON.parse(decodedText);

      if (!data.orderNumber || !data.id) {
        setError('Invalid QR code - not a WKLY Nuts order');
        return;
      }

      // Instant ref-based dedup (no async state delay)
      if (scannedIdsRef.current.has(data.id)) {
        setLastScan({ ...data, status: 'duplicate' });
        lastScanTimeRef.current = now;
        return;
      }

      // Lock processing
      processingRef.current = true;
      lastScanTimeRef.current = now;

      // Mark as scanned immediately (before async DB call)
      scannedIdsRef.current.add(data.id);

      // Update order status to dispatched
      const { error: updateError } = await dbService.updateSalesOrder({
        id: data.id,
        status: 'dispatched',
        dispatch_date: new Date().toISOString().split('T')[0],
      });

      if (updateError) {
        // Remove from set if update failed
        scannedIdsRef.current.delete(data.id);
        setLastScan({ ...data, status: 'error', message: updateError.message });
        showToast(`Error updating ${data.orderNumber}`, 'error');
      } else {
        setLastScan({ ...data, status: 'success' });
        setScannedOrders(prev => [...prev, { ...data, scannedAt: new Date() }]);
        showToast(`${data.orderNumber} → Dispatched!`, 'success');

        // Deduct inventory on dispatch
        const invResult = await dbService.deductInventoryForOrder({ id: data.id, items: data.items || [] });
        if (invResult && invResult.warnings && invResult.warnings.length > 0) {
          showToast(`Stock warning: ${invResult.warnings[0]}`, 'error');
        }
      }
    } catch (err) {
      setError('Invalid QR code format');
    } finally {
      processingRef.current = false;
    }
  };

  const handleFinish = () => {
    stopScanner();
    if (onScanComplete) {
      onScanComplete(scannedOrders);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Scan Orders for Dispatch</h2>
            <p className="text-sm text-gray-500 mt-1">
              {scannedOrders.length} order{scannedOrders.length !== 1 ? 's' : ''} scanned
            </p>
          </div>
          <button onClick={handleFinish} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Camera View */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
            <div id="qr-reader" ref={scannerRef} className="w-full" />

            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <button
                  onClick={startScanner}
                  className="flex items-center gap-3 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-lg"
                >
                  <Camera className="w-6 h-6" />
                  Start Camera
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
              lastScan.status === 'duplicate' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              {lastScan.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {lastScan.orderNumber} - {lastScan.customer}
                </p>
                <p className="text-xs text-gray-600">
                  {lastScan.status === 'success' ? 'Marked as Dispatched' :
                   lastScan.status === 'duplicate' ? 'Already scanned' :
                   lastScan.message || 'Error updating'}
                </p>
              </div>
            </div>
          )}

          {/* Scanned Orders List */}
          {scannedOrders.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-sm">Scanned Orders</h3>
              <div className="space-y-1">
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
              <button
                onClick={stopScanner}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
              >
                Stop Camera
              </button>
            )}
            <button
              onClick={handleFinish}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
            >
              Done ({scannedOrders.length} dispatched)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
