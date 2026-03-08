import React, { useState, useRef, useMemo, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Calendar, CheckSquare, Square } from 'lucide-react';

export default function BulkLabelPrint({ orders, onClose, showToast }) {
  const printRef = useRef(null);
  const [labelSize, setLabelSize] = useState('a4');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const isA4 = labelSize === 'a4';
  const s = isA4 ? 1.4 : 1;

  // Filter orders by selected date
  const dateOrders = useMemo(() => {
    return (orders || []).filter(o => {
      const d = o.order_date || o.created_at?.split('T')[0];
      return d === selectedDate;
    });
  }, [orders, selectedDate]);

  // Auto-select all on date change
  useEffect(() => {
    setSelectedIds(new Set(dateOrders.map(o => o.id)));
  }, [dateOrders.length, selectedDate]);

  const toggleOrder = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === dateOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(dateOrders.map(o => o.id)));
    }
  };

  const selectedOrders = dateOrders.filter(o => selectedIds.has(o.id));

  const handlePrint = () => {
    if (selectedOrders.length === 0) {
      showToast('No orders selected to print', 'error');
      return;
    }

    const printContent = printRef.current;
    const printWindow = window.open('', '_blank');

    const pageWidth = isA4 ? '210mm' : '152mm';
    const pageHeight = isA4 ? '297mm' : '102mm';

    printWindow.document.write(`
      <html>
        <head>
          <title>Bulk Labels - ${selectedDate}</title>
          <style>
            @page { size: ${pageWidth} ${pageHeight}; margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .label-page { page-break-after: always; }
            .label-page:last-child { page-break-after: avoid; }
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
    showToast(`Printing ${selectedOrders.length} labels`, 'success');
  };

  // Render a single label
  const renderLabel = (order) => {
    const items = order.items || [];
    const trackingNumber = order.tracking_number || '';
    const courierName = order.courier_name || 'ST Courier';
    const shippingDate = order.dispatch_date || order.order_date || selectedDate;
    const address = order.shipping_address || '';

    const hasMonthly = items.some(i => (i.pack_type || i.packType || '').toLowerCase().includes('month'));
    const dimensions = hasMonthly ? '26.7x20.3x21.6cm' : '21.6x14.0x10.2cm';
    const estimatedWeight = items.reduce((s, i) => {
      const qty = i.quantity || 0;
      const pt = (i.pack_type || i.packType || '').toLowerCase();
      return s + (pt.includes('month') ? qty * 1.0 : qty * 0.25);
    }, 0);

    const itemsSummary = items.map(i =>
      `${i.sku_name || i.skuName} (${i.pack_type || i.packType}) x${i.quantity}`
    ).join(', ');

    return (
      <div key={order.id} className="label-page" style={{ padding: isA4 ? '15mm' : '3mm' }}>
        <div style={{
          border: '3px solid #000',
          borderRadius: '4px',
          background: '#fff',
          overflow: 'hidden',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}>
          {/* SHIP TO + FROM */}
          <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
            <div style={{ flex: 1, padding: `${8*s}px ${10*s}px`, borderRight: '2px solid #000' }}>
              <div style={{ display: 'inline-block', background: '#000', color: '#fff', fontWeight: 'bold', fontSize: `${10*s}px`, padding: `${2*s}px ${6*s}px`, borderRadius: '2px' }}>SHIP TO:</div>
              <div style={{ marginTop: `${4*s}px` }}>
                <div style={{ fontSize: `${10*s}px`, fontWeight: '500', lineHeight: '1.4' }}>{order.customer_name}</div>
                {address && <div style={{ fontSize: `${9*s}px`, color: '#333', lineHeight: '1.4', marginTop: '2px' }}>{address}</div>}
                {order.phone && <div style={{ fontSize: `${9*s}px`, color: '#333', marginTop: '2px' }}>Ph: {order.phone}</div>}
              </div>
            </div>
            <div style={{ flex: 1, padding: `${8*s}px ${10*s}px` }}>
              <div style={{ fontWeight: 'bold', fontSize: `${10*s}px` }}>FROM:</div>
              <div style={{ marginTop: `${4*s}px` }}>
                <div style={{ fontSize: `${10*s}px`, fontWeight: '500' }}>WKLY Nuts</div>
                <div style={{ fontSize: `${9*s}px`, color: '#333', marginTop: '2px' }}>Chennai, Tamil Nadu, India</div>
              </div>
            </div>
          </div>

          {/* Details + Remarks */}
          <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
            <div style={{ flex: 1, borderRight: '2px solid #000' }}>
              {[
                ['ORDER ID:', order.order_number],
                ['WEIGHT:', `${estimatedWeight.toFixed(1)} KG`],
                ['DIMENSIONS:', dimensions],
                ['SHIP DATE:', shippingDate],
              ].map(([label, val], i) => (
                <div key={i} style={{ display: 'flex', borderBottom: i < 3 ? '1px solid #000' : 'none', fontSize: `${9*s}px` }}>
                  <div style={{ fontWeight: 'bold', padding: `${4*s}px ${8*s}px`, minWidth: `${isA4 ? 140 : 95}px`, borderRight: '1px solid #ccc', background: '#f5f5f5' }}>{label}</div>
                  <div style={{ padding: `${4*s}px ${8*s}px`, fontWeight: '500' }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ minWidth: `${isA4 ? 160 : 110}px`, padding: `${4*s}px ${8*s}px` }}>
              <div style={{ fontWeight: 'bold', fontSize: `${9*s}px`, marginBottom: `${3*s}px` }}>REMARKS:</div>
              <div style={{ fontSize: `${8*s}px`, color: '#444', lineHeight: '1.3' }}>
                {order.payment_method === 'cod' ? (
                  <span style={{ fontWeight: 'bold', color: '#c00' }}>COD ₹{(order.total_amount||0).toFixed(0)}</span>
                ) : itemsSummary || 'NO REMARKS'}
                {order.total_amount && <div style={{ marginTop: '3px', fontWeight: 'bold', fontSize: `${9*s}px` }}>₹{order.total_amount.toFixed(0)}</div>}
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div style={{ padding: `${8*s}px`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <QRCodeSVG
              value={JSON.stringify({ id: order.id, orderNumber: order.order_number, customer: order.customer_name, tracking: trackingNumber || undefined, total: order.total_amount })}
              size={isA4 ? 110 : 75}
              level="M"
              includeMargin={true}
            />
            <div style={{ fontSize: `${8*s}px`, color: '#555', marginTop: '2px', letterSpacing: '1px', fontWeight: '500' }}>
              {trackingNumber || order.order_number}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Bulk Print Labels</h2>
            <p className="text-sm text-gray-500">{selectedOrders.length} of {dateOrders.length} orders selected</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button onClick={() => setLabelSize('4x6')} className={`px-3 py-1.5 text-sm font-medium ${labelSize === '4x6' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}>4x6</button>
              <button onClick={() => setLabelSize('a4')} className={`px-3 py-1.5 text-sm font-medium ${labelSize === 'a4' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}>A4</button>
            </div>
            <button onClick={handlePrint} disabled={selectedOrders.length === 0} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50">
              <Printer className="w-4 h-4" /> Print All ({selectedOrders.length})
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Date Filter */}
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
            <Calendar className="w-5 h-5 text-gray-500" />
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedIds(new Set()); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1" />
            <span className="text-sm text-gray-600 font-medium">{dateOrders.length} orders</span>
          </div>

          {/* Quick date buttons */}
          <div className="flex gap-2">
            {[
              { label: 'Today', date: new Date().toISOString().split('T')[0] },
              { label: 'Yesterday', date: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
            ].map(d => (
              <button key={d.label} onClick={() => { setSelectedDate(d.date); setSelectedIds(new Set()); }}
                className={`px-3 py-1 rounded-full text-xs font-medium ${selectedDate === d.date ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {d.label}
              </button>
            ))}
          </div>

          {/* Order List with Checkboxes */}
          {dateOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No orders for this date</p>
            </div>
          ) : (
            <div className="space-y-1">
              <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-teal-600 font-medium mb-2 hover:text-teal-700">
                {selectedIds.size === dateOrders.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectedIds.size === dateOrders.length ? 'Deselect All' : 'Select All'}
              </button>
              {dateOrders.map(order => (
                <div key={order.id} onClick={() => toggleOrder(order.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${selectedIds.has(order.id) ? 'bg-teal-50 border-teal-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  {selectedIds.has(order.id) ? <CheckSquare className="w-4 h-4 text-teal-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{order.order_number}</span>
                      <span className="text-xs text-gray-500">{order.customer_name}</span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {(order.items || []).map(i => `${i.sku_name || i.skuName} x${i.quantity}`).join(', ') || 'No items'}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">₹{(order.total_amount || 0).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hidden print content */}
        <div ref={printRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          {selectedOrders.map(order => renderLabel(order))}
        </div>
      </div>
    </div>
  );
}
