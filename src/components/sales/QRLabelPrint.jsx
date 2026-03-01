import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';

export default function QRLabelPrint({ order, onClose, labelSize = 'a4' }) {
  const printRef = useRef();

  // QR data contains order ID, customer, items summary
  const qrData = JSON.stringify({
    id: order.id,
    orderNumber: order.order_number,
    customer: order.customer_name,
    items: (order.items || []).map(i => `${i.sku_name || i.skuName} x${i.quantity}`).join(', '),
    total: order.total_amount,
    date: order.order_date,
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open('', '_blank');

    const isA4 = labelSize === 'a4';
    const pageWidth = isA4 ? '210mm' : '152mm'; // 6 inches
    const pageHeight = isA4 ? '297mm' : '102mm'; // 4 inches

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
              font-family: Arial, sans-serif;
              width: ${pageWidth};
              height: ${pageHeight};
            }
            .label-container {
              padding: ${isA4 ? '20mm' : '5mm'};
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
            }
            .label-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: ${isA4 ? '15mm' : '3mm'};
              border-bottom: 2px solid #000;
              padding-bottom: ${isA4 ? '8mm' : '2mm'};
            }
            .brand-name {
              font-size: ${isA4 ? '24pt' : '14pt'};
              font-weight: bold;
              color: #0d9488;
            }
            .order-id {
              font-size: ${isA4 ? '14pt' : '10pt'};
              font-weight: bold;
            }
            .label-body {
              display: flex;
              gap: ${isA4 ? '15mm' : '5mm'};
              flex: 1;
            }
            .info-section { flex: 1; }
            .qr-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .section-title {
              font-size: ${isA4 ? '10pt' : '7pt'};
              font-weight: bold;
              text-transform: uppercase;
              color: #666;
              margin-bottom: ${isA4 ? '3mm' : '1mm'};
            }
            .customer-name {
              font-size: ${isA4 ? '16pt' : '11pt'};
              font-weight: bold;
              margin-bottom: ${isA4 ? '3mm' : '1mm'};
            }
            .address {
              font-size: ${isA4 ? '12pt' : '8pt'};
              line-height: 1.4;
              margin-bottom: ${isA4 ? '8mm' : '2mm'};
            }
            .items-list {
              font-size: ${isA4 ? '10pt' : '7pt'};
              margin-bottom: ${isA4 ? '5mm' : '2mm'};
            }
            .items-list div {
              padding: 2px 0;
              border-bottom: 1px dashed #ccc;
            }
            .total-amount {
              font-size: ${isA4 ? '14pt' : '10pt'};
              font-weight: bold;
              margin-top: ${isA4 ? '3mm' : '1mm'};
            }
            .footer {
              border-top: 1px solid #000;
              padding-top: ${isA4 ? '5mm' : '2mm'};
              font-size: ${isA4 ? '8pt' : '6pt'};
              color: #666;
              display: flex;
              justify-content: space-between;
              margin-top: auto;
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
    }, 300);
  };

  const items = order.items || [];
  const isA4 = labelSize === 'a4';
  const qrSize = isA4 ? 150 : 80;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Shipping Label Preview</h2>
          <div className="flex items-center gap-3">
            <select
              value={labelSize}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              disabled
            >
              <option value="a4">A4 Paper</option>
              <option value="4x6">4x6 Thermal</option>
            </select>
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
        <div className="p-6">
          <div
            ref={printRef}
            className={`border-2 border-dashed border-gray-400 bg-white ${
              isA4 ? 'p-8' : 'p-4'
            }`}
            style={{
              width: isA4 ? '100%' : '576px',
              minHeight: isA4 ? '400px' : '240px',
            }}
          >
            <div className="label-container">
              {/* Label Header */}
              <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
                <div>
                  <div className="text-2xl font-bold text-teal-600">WKLY NUTS</div>
                  <div className="text-xs text-gray-500">Premium Health Snacks</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{order.order_number}</div>
                  <div className="text-xs text-gray-500">{order.order_date}</div>
                </div>
              </div>

              {/* Label Body */}
              <div className="flex gap-6">
                {/* Info Section */}
                <div className="flex-1">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1">Ship To:</div>
                  <div className={`font-bold ${isA4 ? 'text-xl' : 'text-base'} mb-1`}>
                    {order.customer_name}
                  </div>
                  {order.shipping_address && (
                    <div className={`${isA4 ? 'text-sm' : 'text-xs'} text-gray-700 mb-3 leading-relaxed`}>
                      {order.shipping_address}
                    </div>
                  )}
                  {order.phone && (
                    <div className={`${isA4 ? 'text-sm' : 'text-xs'} text-gray-600 mb-3`}>
                      Ph: {order.phone}
                    </div>
                  )}

                  {/* Items */}
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1 mt-3">Items:</div>
                  <div className="space-y-1">
                    {items.map((item, idx) => (
                      <div key={idx} className={`${isA4 ? 'text-sm' : 'text-xs'} border-b border-dashed border-gray-300 pb-1`}>
                        {item.sku_name || item.skuName} ({item.pack_type || item.packType}) x{item.quantity}
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className={`font-bold ${isA4 ? 'text-lg' : 'text-sm'} mt-3`}>
                    Total: ₹{order.total_amount?.toFixed(2) || '0.00'}
                    {order.payment_method === 'cod' && (
                      <span className="text-red-600 ml-2">(COD)</span>
                    )}
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="flex flex-col items-center justify-center">
                  <QRCodeSVG
                    value={qrData}
                    size={qrSize}
                    level="M"
                    includeMargin={true}
                  />
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    Scan to verify
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-400 mt-4 pt-2 flex justify-between text-xs text-gray-500">
                <span>Source: {order.order_source || 'Direct'}</span>
                <span>Payment: {order.payment_method?.toUpperCase() || 'N/A'}</span>
                {order.courier_name && <span>Courier: {order.courier_name}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
