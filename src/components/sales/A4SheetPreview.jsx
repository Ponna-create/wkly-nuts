import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { a4LayoutFor, a4CellSize, itemsSummary } from '../../utils/a4LabelSheet';
import { labelQrValue } from '../../utils/labelPrint';

// On-screen picture of the A4 label sheet, drawn from the same measurements
// as the PDF in utils/a4LabelSheet.js (mm and pt scaled to screen pixels),
// so what you see here is what the PDF prints. Empty cells show where the
// next labels on the sheet would go.
const PAGE_W = 210, PAGE_H = 297, MARGIN = 8, GAP = 4, PAD = 4.5;
const PT_TO_MM = 0.3528;

export default function A4SheetPreview({ orders, perSheet, withQr, business, width = 320 }) {
  const L = a4LayoutFor(perSheet);
  const { w, h } = a4CellSize(L);
  const k = width / PAGE_W;
  const mm = (v) => `${v * k}px`;
  const pt = (v) => `${v * PT_TO_MM * k}px`;
  const cells = Array.from({ length: L.cols * L.rows }, (_, i) => orders[i] || null);

  return (
    <div style={{ width: `${width}px`, height: `${PAGE_H * k}px`, background: '#fff', position: 'relative', boxShadow: '0 1px 4px rgba(0,0,0,.15)', fontFamily: 'Helvetica, Arial, sans-serif', color: '#111' }}>
      {cells.map((order, i) => {
        const col = i % L.cols, row = Math.floor(i / L.cols);
        return (
          <div key={i} style={{
            position: 'absolute', left: mm(MARGIN + col * (w + GAP)), top: mm(MARGIN + row * (h + GAP)),
            width: mm(w), height: mm(h), border: '1px dashed #9a9791', padding: mm(PAD), overflow: 'hidden', boxSizing: 'border-box',
          }}>
            {order ? (
              <>
                <div style={{ fontSize: pt(7), fontWeight: 'bold', color: '#555' }}>TO</div>
                <div style={{ fontSize: pt(L.name), fontWeight: 'bold', lineHeight: 1.15 }}>{order.customer_name}</div>
                <div style={{ fontSize: pt(L.addr), lineHeight: 1.25 }}>{order.shipping_address}</div>
                <div style={{ fontSize: pt(L.phone), fontWeight: 'bold' }}>Ph: {order.courier_number || order.phone || '—'}</div>
                <div style={{ borderTop: '1px solid #bbb', margin: `${mm(1)} 0` }} />
                <div style={{ fontSize: pt(7), fontWeight: 'bold', color: '#555' }}>FROM</div>
                <div style={{ fontSize: pt(L.fromName), fontWeight: 'bold' }}>{business.companyName || 'WKLY Nuts'}</div>
                <div style={{ fontSize: pt(L.fromAddr), lineHeight: 1.25 }}>{business.registeredAddress || 'Chennai, Tamil Nadu'}</div>
                <div style={{ fontSize: pt(L.fromPhone), fontWeight: 'bold' }}>Ph: {business.phone || '—'}</div>
                <div style={{ position: 'absolute', left: mm(PAD), right: mm(PAD), top: mm(L.orderOffset), borderTop: '1px solid #000', paddingTop: mm(1), display: 'flex', gap: mm(3) }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: pt(L.orderSize), fontWeight: 'bold' }}>{order.order_number}</div>
                    <div style={{ fontSize: pt(L.itemSize), lineHeight: 1.25 }}>{itemsSummary(order)}</div>
                  </div>
                </div>
                {withQr && (
                  <div style={{ position: 'absolute', right: mm(PAD), bottom: mm(PAD), width: mm(L.qr), height: mm(L.qr) }}>
                    <QRCodeSVG value={labelQrValue(order)} size={L.qr * k} level="M" includeMargin={false} />
                  </div>
                )}
              </>
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: '11px', color: '#bbb' }}>Label {i + 1}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
