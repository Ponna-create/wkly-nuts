import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';

export default function LabelPrinter({ order, onClose, labelSize: initialSize = '4x6' }) {
  const printRef = useRef(null);
  const [labelSize, setLabelSize] = useState(initialSize);

  const isA4 = labelSize === 'a4';

  // Calculate total weight from items
  const items = order.items || [];
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  // Approximate weight: ~250g per weekly pack, ~1kg per monthly
  const estimatedWeight = items.reduce((s, i) => {
    const qty = i.quantity || 0;
    const packType = (i.pack_type || i.packType || '').toLowerCase();
    if (packType.includes('month')) return s + qty * 1.0;
    return s + qty * 0.25;
  }, 0);

  // Box dimensions based on pack type
  const hasMonthly = items.some(i => (i.pack_type || i.packType || '').toLowerCase().includes('month'));
  const dimensions = hasMonthly ? '26.7 x 20.3 x 21.6 cm' : '21.6 x 14.0 x 10.2 cm';

  const trackingNumber = order.tracking_number || '';
  const courierName = order.courier_name || 'ST Courier';
  const shippingDate = order.dispatch_date || order.order_date || new Date().toISOString().split('T')[0];

  // Parse address for city/pincode
  const address = order.shipping_address || '';
  const pinMatch = address.match(/\b(\d{6})\b/);
  const pincode = order.pincode || (pinMatch ? pinMatch[1] : '');

  // Items summary for remarks
  const itemsSummary = items.map(i =>
    `${i.sku_name || i.skuName} (${i.pack_type || i.packType}) x${i.quantity}`
  ).join(', ');

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open('', '_blank');

    const pageWidth = isA4 ? '210mm' : '152mm';
    const pageHeight = isA4 ? '297mm' : '102mm';

    printWindow.document.write(`
      <html>
        <head>
          <title>Shipping Label - ${order.order_number}</title>
          <style>
            @page {
              size: ${pageWidth} ${pageHeight};
              margin: 0;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: Arial, Helvetica, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  // Scaling factors
  const s = isA4 ? 1.6 : 1; // scale multiplier

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">Shipping Label</h2>
          <div className="flex items-center gap-3">
            {/* Size Toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setLabelSize('4x6')}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  labelSize === '4x6'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                4x6 Thermal
              </button>
              <button
                onClick={() => setLabelSize('a4')}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  labelSize === 'a4'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                A4 Paper
              </button>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Label Preview */}
        <div className="p-6 bg-blue-50 flex justify-center">
          <div
            ref={printRef}
            style={{
              width: isA4 ? '540px' : '380px',
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            {/* Outer border */}
            <div style={{
              border: '3px solid #000',
              borderRadius: `${4 * s}px`,
              background: '#fff',
              overflow: 'hidden',
            }}>

              {/* === TOP ROW: SHIP TO + FROM === */}
              <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
                {/* SHIP TO */}
                <div style={{ flex: 1, padding: `${10 * s}px ${12 * s}px`, borderRight: '2px solid #000' }}>
                  <div style={{
                    display: 'inline-block',
                    background: '#000',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: `${11 * s}px`,
                    padding: `${2 * s}px ${8 * s}px`,
                    marginBottom: `${6 * s}px`,
                    borderRadius: `${2 * s}px`,
                  }}>
                    SHIP TO:
                  </div>
                  <div style={{ marginTop: `${6 * s}px` }}>
                    <div style={{ fontSize: `${11 * s}px`, fontWeight: '500', lineHeight: '1.5' }}>
                      {order.customer_name}
                    </div>
                    {address && (
                      <div style={{ fontSize: `${10 * s}px`, color: '#333', lineHeight: '1.5', marginTop: `${2 * s}px` }}>
                        {address}
                      </div>
                    )}
                    {order.phone && (
                      <div style={{ fontSize: `${10 * s}px`, color: '#333', marginTop: `${2 * s}px` }}>
                        Ph: {order.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* FROM */}
                <div style={{ flex: 1, padding: `${10 * s}px ${12 * s}px` }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: `${11 * s}px`,
                    marginBottom: `${6 * s}px`,
                  }}>
                    FROM:
                  </div>
                  <div style={{ marginTop: `${4 * s}px` }}>
                    <div style={{ fontSize: `${11 * s}px`, fontWeight: '500', lineHeight: '1.5' }}>
                      WKLY Nuts
                    </div>
                    <div style={{ fontSize: `${10 * s}px`, color: '#333', lineHeight: '1.5', marginTop: `${2 * s}px` }}>
                      Chennai, Tamil Nadu,<br />
                      India
                    </div>
                  </div>
                </div>
              </div>

              {/* === MIDDLE ROW: Details + Remarks === */}
              <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
                {/* Left details */}
                <div style={{ flex: 1, borderRight: '2px solid #000' }}>
                  {/* ORDER ID */}
                  <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #000',
                    fontSize: `${10 * s}px`,
                  }}>
                    <div style={{
                      fontWeight: 'bold',
                      padding: `${5 * s}px ${10 * s}px`,
                      minWidth: `${isA4 ? 160 : 105}px`,
                      borderRight: '1px solid #ccc',
                      background: '#f5f5f5',
                    }}>
                      ORDER ID:
                    </div>
                    <div style={{ padding: `${5 * s}px ${10 * s}px`, fontWeight: '500' }}>
                      {order.order_number}
                    </div>
                  </div>

                  {/* WEIGHT */}
                  <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #000',
                    fontSize: `${10 * s}px`,
                  }}>
                    <div style={{
                      fontWeight: 'bold',
                      padding: `${5 * s}px ${10 * s}px`,
                      minWidth: `${isA4 ? 160 : 105}px`,
                      borderRight: '1px solid #ccc',
                      background: '#f5f5f5',
                    }}>
                      WEIGHT:
                    </div>
                    <div style={{ padding: `${5 * s}px ${10 * s}px` }}>
                      {estimatedWeight.toFixed(1)} KG
                    </div>
                  </div>

                  {/* DIMENSIONS */}
                  <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #000',
                    fontSize: `${10 * s}px`,
                  }}>
                    <div style={{
                      fontWeight: 'bold',
                      padding: `${5 * s}px ${10 * s}px`,
                      minWidth: `${isA4 ? 160 : 105}px`,
                      borderRight: '1px solid #ccc',
                      background: '#f5f5f5',
                    }}>
                      DIMENSIONS:
                    </div>
                    <div style={{ padding: `${5 * s}px ${10 * s}px` }}>
                      {dimensions}
                    </div>
                  </div>

                  {/* SHIPPING DATE */}
                  <div style={{
                    display: 'flex',
                    fontSize: `${10 * s}px`,
                  }}>
                    <div style={{
                      fontWeight: 'bold',
                      padding: `${5 * s}px ${10 * s}px`,
                      minWidth: `${isA4 ? 160 : 105}px`,
                      borderRight: '1px solid #ccc',
                      background: '#f5f5f5',
                    }}>
                      SHIPPING DATE:
                    </div>
                    <div style={{ padding: `${5 * s}px ${10 * s}px` }}>
                      {shippingDate}
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                <div style={{ flex: 0, minWidth: `${isA4 ? 180 : 120}px`, padding: `${5 * s}px ${10 * s}px` }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: `${10 * s}px`,
                    marginBottom: `${4 * s}px`,
                  }}>
                    REMARKS:
                  </div>
                  <div style={{ fontSize: `${9 * s}px`, color: '#444', lineHeight: '1.4' }}>
                    {order.payment_method === 'cod' ? (
                      <span style={{ fontWeight: 'bold', color: '#c00' }}>COD - Collect ₹{(order.total_amount || 0).toFixed(0)}</span>
                    ) : items.length > 0 ? (
                      <span>{itemsSummary}</span>
                    ) : (
                      <span style={{ color: '#999' }}>NO REMARKS</span>
                    )}
                    {courierName && (
                      <div style={{ marginTop: `${3 * s}px`, fontSize: `${8 * s}px`, color: '#666' }}>
                        Courier: {courierName}
                      </div>
                    )}
                    {order.total_amount && (
                      <div style={{ marginTop: `${3 * s}px`, fontWeight: 'bold', fontSize: `${10 * s}px` }}>
                        ₹{order.total_amount.toFixed(0)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* === BOTTOM: QR Code === */}
              <div style={{
                padding: `${10 * s}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
              }}>
                <QRCodeSVG
                  value={JSON.stringify({
                    id: order.id,
                    orderNumber: order.order_number,
                    customer: order.customer_name,
                    tracking: trackingNumber || undefined,
                    total: order.total_amount,
                  })}
                  size={isA4 ? 130 : 90}
                  level="M"
                  includeMargin={true}
                />
                <div style={{
                  fontSize: `${9 * s}px`,
                  color: '#555',
                  marginTop: `${2 * s}px`,
                  letterSpacing: '1px',
                  fontWeight: '500',
                }}>
                  {trackingNumber || order.order_number}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-3 justify-between items-center">
          <div className="text-xs text-gray-500">
            {trackingNumber ? `Tracking: ${trackingNumber}` : `Order: ${order.order_number}`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
            >
              <Printer className="w-4 h-4" />
              Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
