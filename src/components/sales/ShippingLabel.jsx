import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { labelQrValue } from '../../utils/labelPrint';

// One shipping label, drawn with inline styles only: the print window copies
// this HTML into a blank page that has none of the app's CSS.
//
// Templates (chosen in Settings → Shipping Label):
//   compact  — India Post style: QR + order block on top, big Deliver To,
//              sender and contents side by side, return line at the bottom
//   detailed — the original label: details table, remarks, QR at the bottom
//   large    — very big delivery address for hand sorting, small QR strip
//
// `show` switches individual details on/off; `overrides` carries the values
// edited in the single-label print window (weight, courier, date, contents).

export const LABEL_TEMPLATES = {
  compact: { name: 'Compact', note: 'India Post style. QR and order on top, big address.' },
  detailed: { name: 'Detailed', note: 'The original layout with a details table.' },
  large: { name: 'Big address', note: 'Very large delivery address, small QR.' },
};

const pretty = (s) => String(s || '').replace(/^\w/, c => c.toUpperCase());

export function labelData(order, overrides = {}) {
  const items = order.items || [];
  const hasMonthly = items.some(i => (i.pack_type || i.packType || '').toLowerCase().includes('month'));
  const weight = overrides.weight ?? items.reduce((s, i) => {
    const qty = i.quantity || 0;
    const pt = (i.pack_type || i.packType || '').toLowerCase();
    return s + (pt.includes('month') ? qty * 1.0 : qty * 0.25);
  }, 0).toFixed(1);
  const contents = overrides.contents ?? items.map(i =>
    `${i.sku_name || i.skuName} (${pretty(i.pack_type || i.packType)}) ×${i.quantity}`
  ).join(', ');
  const address = order.shipping_address || '';
  const pins = address.match(/\b\d{6}\b/g);
  return {
    name: order.customer_name || order.customers?.name || '',
    address,
    pin: pins ? pins[pins.length - 1] : (order.customers?.pincode || ''),
    phone: order.courier_number || order.phone || '',
    weight,
    dimensions: overrides.dimensions ?? (hasMonthly ? '26.7 x 20.3 x 21.6 cm' : '21.6 x 14.0 x 10.2 cm'),
    shipDate: overrides.shipDate ?? (order.dispatch_date || order.order_date || ''),
    // Only the courier actually set on the order — never a guessed default.
    courier: overrides.courier ?? (order.courier_name || ''),
    contents,
    isCod: order.payment_method === 'cod',
    total: Number(order.total_amount || 0),
  };
}

export default function ShippingLabel({ order, settings, overrides, paper = '4x6', business }) {
  const { template, fontScale, show } = settings;
  const isA4 = paper === 'a4';
  const s = (isA4 ? 1.4 : 1) * (fontScale || 1);
  const px = (n) => `${Math.round(n * s * 10) / 10}px`;
  const d = labelData(order, overrides);
  const qrSize = isA4 ? 150 : template === 'large' ? 84 : 104;
  const company = business.companyName || 'WKLY Nuts';
  const fromAddress = business.registeredAddress || 'Chennai, Tamil Nadu, India';
  const returnAddress = business.returnAddress || business.registeredAddress || 'Chennai, Tamil Nadu, India';

  const box = { border: '2px solid #000', background: '#fff', color: '#000', fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden' };
  const cap = { fontSize: px(8.5), fontWeight: 'bold', letterSpacing: '0.5px', color: '#000' };
  const codBadge = d.isCod && (
    <div style={{ border: '2px solid #000', fontWeight: 900, fontSize: px(12), padding: `${px(2)} ${px(6)}`, display: 'inline-block' }}>
      COD · COLLECT ₹{d.total.toFixed(0)}
    </div>
  );
  const valueLine = !d.isCod && show.price && d.total > 0 && (
    <div style={{ fontSize: px(10), fontWeight: 'bold' }}>Order value ₹{d.total.toFixed(0)}</div>
  );
  const detailBits = [
    show.shipDate && d.shipDate && ['Date', d.shipDate],
    show.courier && d.courier && ['Courier', d.courier],
    show.weight && d.weight && ['Weight', `${d.weight} kg`],
    show.dimensions && d.dimensions && ['Box', d.dimensions],
  ].filter(Boolean);
  const qr = <QRCodeSVG value={labelQrValue(order)} size={qrSize} level="M" includeMargin={true} />;
  const deliverTo = (big) => (
    <div style={{ padding: `${px(big ? 10 : 7)} ${px(10)}` }}>
      <div style={cap}>DELIVER TO</div>
      <div style={{ fontSize: px(big ? 21 : 15), fontWeight: 900, lineHeight: 1.2, marginTop: px(2) }}>{d.name}</div>
      {d.address && <div style={{ fontSize: px(big ? 15 : 11.5), lineHeight: 1.35, marginTop: px(2) }}>{d.address}</div>}
      {d.pin && <div style={{ fontSize: px(big ? 20 : 14), fontWeight: 900, marginTop: px(3), letterSpacing: '1px' }}>PIN {d.pin}</div>}
      {show.phone && d.phone && <div style={{ fontSize: px(big ? 15 : 12), fontWeight: 'bold', marginTop: px(2) }}>Ph: {d.phone}</div>}
    </div>
  );
  const sender = show.sender && (
    <div style={{ flex: 1, padding: `${px(6)} ${px(10)}`, minWidth: 0 }}>
      <div style={cap}>FROM</div>
      <div style={{ fontSize: px(10.5), fontWeight: 'bold', marginTop: px(1) }}>{company}</div>
      <div style={{ fontSize: px(9), lineHeight: 1.3 }}>{fromAddress}</div>
      {business.phone && <div style={{ fontSize: px(9) }}>Ph: {business.phone}</div>}
    </div>
  );
  const contents = show.contents && d.contents && (
    <div style={{ flex: 1, padding: `${px(6)} ${px(10)}`, minWidth: 0 }}>
      <div style={cap}>CONTENTS</div>
      <div style={{ fontSize: px(9.5), lineHeight: 1.3, marginTop: px(1) }}>{d.contents}</div>
    </div>
  );
  const returnLine = show.returnAddress && (
    <div style={{ fontSize: px(8.5), padding: `${px(4)} ${px(10)}`, borderTop: '1px solid #000', lineHeight: 1.3 }}>
      <b>If undelivered, return to:</b> {company}, {returnAddress}{business.phone ? ` · Ph: ${business.phone}` : ''}
    </div>
  );

  if (template === 'detailed') {
    const rows = [
      ['ORDER ID:', order.order_number],
      show.weight && ['WEIGHT:', `${d.weight} KG`],
      show.dimensions && ['DIMENSIONS:', d.dimensions],
      show.shipDate && ['SHIP DATE:', d.shipDate],
      show.courier && d.courier && ['COURIER:', d.courier],
    ].filter(Boolean);
    return (
      <div style={box}>
        <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
          <div style={{ flex: 1.3, borderRight: show.sender ? '2px solid #000' : 'none', minWidth: 0 }}>{deliverTo(false)}</div>
          {sender}
        </div>
        <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
          <div style={{ flex: 1, borderRight: '2px solid #000' }}>
            {rows.map(([label, val], i) => (
              <div key={label} style={{ display: 'flex', borderBottom: i < rows.length - 1 ? '1px solid #000' : 'none', fontSize: px(9.5) }}>
                <div style={{ fontWeight: 'bold', padding: `${px(4)} ${px(8)}`, minWidth: px(88), borderRight: '1px solid #000' }}>{label}</div>
                <div style={{ padding: `${px(4)} ${px(8)}`, fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ width: px(118), padding: `${px(4)} ${px(8)}`, display: 'flex', flexDirection: 'column', gap: px(4) }}>
            {show.contents && <div style={{ fontSize: px(9), lineHeight: 1.3 }}><b>CONTENTS:</b> {d.contents}</div>}
            {codBadge}{valueLine}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: px(6) }}>
          {qr}
          <div style={{ fontSize: px(11), fontWeight: 'bold', letterSpacing: '1px' }}>{order.order_number}</div>
        </div>
        {returnLine}
      </div>
    );
  }

  if (template === 'large') {
    return (
      <div style={box}>
        <div style={{ borderBottom: '2px solid #000' }}>{deliverTo(true)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: px(8), padding: `${px(4)} ${px(8)}`, borderBottom: show.sender || show.contents ? '2px solid #000' : 'none' }}>
          {qr}
          <div style={{ display: 'flex', flexDirection: 'column', gap: px(3), minWidth: 0 }}>
            <div style={{ fontSize: px(15), fontWeight: 900, letterSpacing: '1px' }}>{order.order_number}</div>
            {detailBits.length > 0 && <div style={{ fontSize: px(9.5) }}>{detailBits.map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>}
            {codBadge}{valueLine}
          </div>
        </div>
        {(show.sender || show.contents) && <div style={{ display: 'flex' }}>{sender}{show.sender && contents ? <div style={{ width: '2px', background: '#000' }} /> : null}{contents}</div>}
        {returnLine}
      </div>
    );
  }

  // compact (default): India Post style
  return (
    <div style={box}>
      <div style={{ display: 'flex', borderBottom: '2px solid #000' }}>
        <div style={{ padding: px(4), borderRight: '2px solid #000', display: 'flex', alignItems: 'center' }}>{qr}</div>
        <div style={{ flex: 1, padding: `${px(6)} ${px(10)}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: px(3), minWidth: 0 }}>
          <div style={cap}>ORDER</div>
          <div style={{ fontSize: px(16), fontWeight: 900, letterSpacing: '1px' }}>{order.order_number}</div>
          {detailBits.map(([k, v]) => (
            <div key={k} style={{ fontSize: px(9.5) }}><b>{k}:</b> {v}</div>
          ))}
          {codBadge}{valueLine}
        </div>
      </div>
      <div style={{ borderBottom: show.sender || show.contents ? '2px solid #000' : 'none' }}>{deliverTo(false)}</div>
      {(show.sender || show.contents) && <div style={{ display: 'flex' }}>{sender}{show.sender && contents ? <div style={{ width: '2px', background: '#000' }} /> : null}{contents}</div>}
      {returnLine}
    </div>
  );
}
