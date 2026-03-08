import React, { useRef, useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Edit3, ChevronDown } from 'lucide-react';

// Box presets
const BOX_PRESETS = [
  { label: 'Weekly Box', dimensions: '21.6 x 14.0 x 10.2 cm', weight: 0.25 },
  { label: 'Monthly Box', dimensions: '26.7 x 20.3 x 21.6 cm', weight: 1.0 },
  { label: 'Custom', dimensions: '', weight: 0 },
];

export default function LabelPrinter({ order, onClose, labelSize: initialSize = '4x6' }) {
  const printRef = useRef(null);
  const [labelSize, setLabelSize] = useState(initialSize);
  const [editing, setEditing] = useState(false);

  const isA4 = labelSize === 'a4';

  // Calculate defaults from order items
  const items = order.items || [];
  const hasMonthly = items.some(i => (i.pack_type || i.packType || '').toLowerCase().includes('month'));
  const defaultBoxIdx = hasMonthly ? 1 : 0;

  const defaultWeight = items.reduce((s, i) => {
    const qty = i.quantity || 0;
    const pt = (i.pack_type || i.packType || '').toLowerCase();
    return s + (pt.includes('month') ? qty * 1.0 : qty * 0.25);
  }, 0);

  const itemsSummary = items.map(i =>
    `${i.sku_name || i.skuName} (${i.pack_type || i.packType}) x${i.quantity}`
  ).join(', ');

  // Editable state
  const [boxType, setBoxType] = useState(defaultBoxIdx);
  const [customDimensions, setCustomDimensions] = useState('');
  const [weight, setWeight] = useState(defaultWeight.toFixed(1));
  const [courier, setCourier] = useState(order.courier_name || 'ST Courier');
  const [remarks, setRemarks] = useState(
    order.payment_method === 'cod'
      ? `COD - Collect ₹${(order.total_amount || 0).toFixed(0)}`
      : itemsSummary || ''
  );
  const [shipDate, setShipDate] = useState(order.dispatch_date || order.order_date || new Date().toISOString().split('T')[0]);

  const trackingNumber = order.tracking_number || '';
  const address = order.shipping_address || '';

  // Resolved values for label
  const dimensions = boxType === 2 ? customDimensions : BOX_PRESETS[boxType].dimensions;

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
            @page { size: ${pageWidth} ${pageHeight}; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const s = isA4 ? 1.6 : 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">Shipping Label</h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button onClick={() => setLabelSize('4x6')} className={`px-3 py-1.5 text-sm font-medium transition ${labelSize === '4x6' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>4x6 Thermal</button>
              <button onClick={() => setLabelSize('a4')} className={`px-3 py-1.5 text-sm font-medium transition ${labelSize === 'a4' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>A4 Paper</button>
            </div>
            <button onClick={() => setEditing(!editing)} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition ${editing ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Edit3 className="w-4 h-4" />
              {editing ? 'Done' : 'Edit'}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Edit Panel */}
        {editing && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 space-y-3">
            <p className="text-xs text-amber-700 font-medium">✏️ Edit label fields below. Changes apply to this print only.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Box Type */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Box Type</label>
                <select
                  value={boxType}
                  onChange={(e) => setBoxType(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {BOX_PRESETS.map((b, i) => (
                    <option key={i} value={i}>{b.label}{b.dimensions ? ` (${b.dimensions})` : ''}</option>
                  ))}
                </select>
              </div>
              {/* Custom Dimensions (only if Custom selected) */}
              {boxType === 2 && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Custom Dimensions</label>
                  <input type="text" value={customDimensions} onChange={e => setCustomDimensions(e.target.value)}
                    placeholder="e.g. 30 x 20 x 15 cm" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              )}
              {/* Weight */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Weight (KG)</label>
                <input type="text" value={weight} onChange={e => setWeight(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {/* Courier */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Courier</label>
                <input type="text" value={courier} onChange={e => setCourier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {/* Shipping Date */}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Shipping Date</label>
                <input type="date" value={shipDate} onChange={e => setShipDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {/* Remarks */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Remarks</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* Label Preview */}
        <div className="p-6 bg-blue-50 flex justify-center">
          <div ref={printRef} style={{ width: isA4 ? '540px' : '380px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div style={{ border: '3px solid #000', borderRadius: `${4*s}px`, background: '#fff', overflow: 'hidden' }}>

              {/* === TOP ROW: SHIP TO + FROM === */}
              <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
                <div style={{ flex: 1, padding: `${10*s}px ${12*s}px`, borderRight: '2px solid #000' }}>
                  <div style={{ display: 'inline-block', background: '#000', color: '#fff', fontWeight: 'bold', fontSize: `${11*s}px`, padding: `${2*s}px ${8*s}px`, marginBottom: `${6*s}px`, borderRadius: `${2*s}px` }}>SHIP TO:</div>
                  <div style={{ marginTop: `${6*s}px` }}>
                    <div style={{ fontSize: `${11*s}px`, fontWeight: '500', lineHeight: '1.5' }}>{order.customer_name}</div>
                    {address && <div style={{ fontSize: `${10*s}px`, color: '#333', lineHeight: '1.5', marginTop: `${2*s}px` }}>{address}</div>}
                    {order.phone && <div style={{ fontSize: `${10*s}px`, color: '#333', marginTop: `${2*s}px` }}>Ph: {order.phone}</div>}
                  </div>
                </div>
                <div style={{ flex: 1, padding: `${10*s}px ${12*s}px` }}>
                  <div style={{ fontWeight: 'bold', fontSize: `${11*s}px`, marginBottom: `${6*s}px` }}>FROM:</div>
                  <div style={{ marginTop: `${4*s}px` }}>
                    <div style={{ fontSize: `${11*s}px`, fontWeight: '500', lineHeight: '1.5' }}>WKLY Nuts</div>
                    <div style={{ fontSize: `${10*s}px`, color: '#333', lineHeight: '1.5', marginTop: `${2*s}px` }}>Chennai, Tamil Nadu,<br/>India</div>
                  </div>
                </div>
              </div>

              {/* === MIDDLE ROW: Details + Remarks === */}
              <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
                <div style={{ flex: 1, borderRight: '2px solid #000' }}>
                  {[
                    ['ORDER ID:', order.order_number],
                    ['WEIGHT:', `${weight} KG`],
                    ['DIMENSIONS:', dimensions],
                    ['SHIP DATE:', shipDate],
                    ['COURIER:', courier],
                  ].map(([label, val], i, arr) => (
                    <div key={i} style={{ display: 'flex', borderBottom: i < arr.length - 1 ? '1px solid #000' : 'none', fontSize: `${10*s}px` }}>
                      <div style={{ fontWeight: 'bold', padding: `${5*s}px ${10*s}px`, minWidth: `${isA4 ? 160 : 105}px`, borderRight: '1px solid #ccc', background: '#f5f5f5' }}>{label}</div>
                      <div style={{ padding: `${5*s}px ${10*s}px`, fontWeight: '500' }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 0, minWidth: `${isA4 ? 180 : 120}px`, padding: `${5*s}px ${10*s}px` }}>
                  <div style={{ fontWeight: 'bold', fontSize: `${10*s}px`, marginBottom: `${4*s}px` }}>REMARKS:</div>
                  <div style={{ fontSize: `${9*s}px`, color: '#444', lineHeight: '1.4' }}>
                    {order.payment_method === 'cod' && !editing ? (
                      <span style={{ fontWeight: 'bold', color: '#c00' }}>COD ₹{(order.total_amount || 0).toFixed(0)}</span>
                    ) : (
                      <span>{remarks || 'NO REMARKS'}</span>
                    )}
                    {order.total_amount && (
                      <div style={{ marginTop: `${3*s}px`, fontWeight: 'bold', fontSize: `${10*s}px` }}>₹{order.total_amount.toFixed(0)}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* === BOTTOM: QR Code === */}
              <div style={{ padding: `${10*s}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff' }}>
                <QRCodeSVG
                  value={JSON.stringify({ id: order.id, orderNumber: order.order_number, customer: order.customer_name, tracking: trackingNumber || undefined, total: order.total_amount })}
                  size={isA4 ? 130 : 90} level="M" includeMargin={true}
                />
                <div style={{ fontSize: `${9*s}px`, color: '#555', marginTop: `${2*s}px`, letterSpacing: '1px', fontWeight: '500' }}>
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
            {' · '}
            <span className="text-amber-600">{BOX_PRESETS[boxType].label}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">Cancel</button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
              <Printer className="w-4 h-4" /> Print Label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
