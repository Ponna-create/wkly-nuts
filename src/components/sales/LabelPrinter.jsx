import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';

export default function LabelPrinter({ order, onClose, labelSize = '4x6' }) {
  const printRef = useRef(null);

  const qrData = JSON.stringify({
    id: order.id,
    orderNumber: order.order_number,
    customer: order.customer_name,
    items: (order.items || []).map(i => `${i.sku_name || i.skuName} (${i.pack_type || i.packType}) x${i.quantity}`),
    total: order.total_amount,
    date: order.order_date,
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open('', '', 'width=600,height=800');

    const isA4 = labelSize === 'a4';
    const pageWidth = isA4 ? '210mm' : '101.6mm'; // 4 inches
    const pageHeight = isA4 ? '297mm' : '152.4mm'; // 6 inches

    printWindow.document.write(`
      <html>
      <head>
        <title>WKLY Nuts - ${order.order_number}</title>
        <style>
          @page { size: ${pageWidth} ${pageHeight}; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          .label {
            width: ${pageWidth};
            height: ${pageHeight};
            padding: ${isA4 ? '15mm' : '5mm'};
            display: flex;
            flex-direction: column;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000;
            padding-bottom: ${isA4 ? '8mm' : '3mm'};
            margin-bottom: ${isA4 ? '5mm' : '3mm'};
          }
          .brand { font-size: ${isA4 ? '24pt' : '16pt'}; font-weight: bold; }
          .tagline { font-size: ${isA4 ? '9pt' : '7pt'}; color: #555; }
          .order-num { font-size: ${isA4 ? '14pt' : '10pt'}; font-weight: bold; text-align: right; }
          .order-date { font-size: ${isA4 ? '10pt' : '8pt'}; color: #555; }
          .body { flex: 1; display: flex; gap: ${isA4 ? '10mm' : '5mm'}; }
          .info { flex: 1; }
          .qr { display: flex; align-items: center; justify-content: center; }
          .section { margin-bottom: ${isA4 ? '5mm' : '3mm'}; }
          .section-title {
            font-size: ${isA4 ? '8pt' : '6pt'};
            font-weight: bold;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 2px;
          }
          .section-value { font-size: ${isA4 ? '12pt' : '9pt'}; font-weight: bold; }
          .section-sub { font-size: ${isA4 ? '10pt' : '7pt'}; color: #555; }
          .items {
            border: 1px solid #ddd;
            border-radius: 3px;
            padding: ${isA4 ? '4mm' : '2mm'};
            margin-top: ${isA4 ? '3mm' : '2mm'};
          }
          .item {
            display: flex;
            justify-content: space-between;
            font-size: ${isA4 ? '10pt' : '7pt'};
            padding: 1mm 0;
            border-bottom: 1px dashed #eee;
          }
          .item:last-child { border-bottom: none; }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: ${isA4 ? '13pt' : '9pt'};
            font-weight: bold;
            padding-top: 2mm;
            border-top: 2px solid #000;
            margin-top: 2mm;
          }
          .footer {
            border-top: 1px solid #ddd;
            padding-top: ${isA4 ? '3mm' : '2mm'};
            font-size: ${isA4 ? '8pt' : '6pt'};
            color: #888;
            text-align: center;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const items = order.items || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Print Shipping Label</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Label Size Toggle */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Label Size:</span>
          <div className="flex gap-2">
            <LabelSizeBtn
              active={labelSize === '4x6'}
              label="4x6 Thermal"
              sublabel="Helett H30C"
            />
            <LabelSizeBtn
              active={labelSize === 'a4'}
              label="A4 Paper"
              sublabel="Standard printer"
            />
          </div>
        </div>

        {/* Label Preview */}
        <div className="p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-1 bg-gray-50">
            <div ref={printRef}>
              <div className="label bg-white p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
                  <div>
                    <div className="text-xl font-bold">WKLY NUTS</div>
                    <div className="text-xs text-gray-500">Premium Nuts & Seeds</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{order.order_number}</div>
                    <div className="text-xs text-gray-500">{order.order_date}</div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex gap-4">
                  {/* Left - Info */}
                  <div className="flex-1 space-y-3">
                    {/* Ship To */}
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ship To</div>
                      <div className="text-sm font-bold text-gray-900">{order.customer_name}</div>
                      {order.shipping_address && (
                        <div className="text-xs text-gray-600 mt-0.5 leading-tight">{order.shipping_address}</div>
                      )}
                      {order.phone && (
                        <div className="text-xs text-gray-600 mt-0.5">{order.phone}</div>
                      )}
                    </div>

                    {/* Items */}
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Items</div>
                      <div className="border border-gray-200 rounded p-2 mt-1 space-y-1">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span>{item.sku_name || item.skuName} ({item.pack_type || item.packType})</span>
                            <span className="font-medium">x{item.quantity}</span>
                          </div>
                        ))}
                        {/* Total */}
                        <div className="flex justify-between text-xs font-bold border-t border-gray-200 pt-1 mt-1">
                          <span>Total</span>
                          <span>₹{order.total_amount?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="flex gap-4">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment</div>
                        <div className="text-xs font-medium capitalize">{order.payment_method} - {order.payment_status}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source</div>
                        <div className="text-xs font-medium capitalize">{order.order_source}</div>
                      </div>
                    </div>
                  </div>

                  {/* Right - QR Code */}
                  <div className="flex flex-col items-center justify-center">
                    <QRCodeSVG
                      value={qrData}
                      size={120}
                      level="M"
                      includeMargin={true}
                    />
                    <div className="text-[9px] text-gray-400 mt-1 text-center">{order.order_number}</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-2 mt-3 text-center">
                  <div className="text-[9px] text-gray-400">WKLY Nuts | Chennai | wklynuts.com</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-3 justify-end">
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
  );
}

function LabelSizeBtn({ active, label, sublabel }) {
  return (
    <div className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer border ${
      active ? 'bg-teal-50 border-teal-600 text-teal-700' : 'bg-white border-gray-300 text-gray-600'
    }`}>
      <div className="font-medium">{label}</div>
      <div className="text-xs text-gray-500">{sublabel}</div>
    </div>
  );
}
