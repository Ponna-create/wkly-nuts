import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { labelData } from '../components/sales/ShippingLabel';
import { labelQrValue } from './labelPrint';
import { oneLineAddress } from './a4LabelSheet';

// Thermal labels as a real PDF whose pages are exactly the sticker size
// (4x6 or 4x5 inches), one label per page. Made for printing from an iPhone:
// the PDF is shared to the printer's app over Bluetooth, which prints each page
// at actual size. (Printing from the browser put the label on a Letter page
// with headers, because the phone's print dialog has no 4x6 paper.)
//
// Same content as the Compact label (components/sales/ShippingLabel.jsx): QR +
// order on top, big Deliver To, From and Contents side by side, return line.
// Drawn as text and lines (not a picture), so it stays sharp on the printer.

const PAGES = { '4x6': [101.6, 152.4], '4x5': [101.6, 127] };
const PT = 0.3528; // mm per point
const lineH = (pt, k = 1.22) => pt * PT * k;
// The PDF's built-in font has no rupee sign or Indian scripts
const clean = (s) => String(s ?? '').replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E -ÿ]/g, '');

function drawCompact(doc, { order, d, show, business, qr, W, H, s }) {
  const M = 3;                 // page margin
  const x0 = M, w = W - 2 * M; // label box
  const pad = 2.6;
  const company = clean(business.companyName || 'WKLY Nuts');
  const fromAddress = clean(business.registeredAddress || 'Chennai, Tamil Nadu, India');
  const returnAddress = clean(business.returnAddress || business.registeredAddress || 'Chennai, Tamil Nadu, India');
  let y = M;
  const rules = [];            // horizontal lines across the box (y)

  const text = (str, x, yy, pt, bold, maxW) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(pt * s);
    const lines = maxW ? doc.splitTextToSize(clean(str), maxW) : [clean(str)];
    lines.forEach((ln, i) => doc.text(ln, x, yy + i * lineH(pt * s)));
    return lines.length * lineH(pt * s);
  };
  const cap = (str, x, yy) => text(str, x, yy, 7.5, true);

  // --- top: QR | order block
  const qrSide = 30 * Math.min(1, s + 0.1);
  const topH = Math.max(qrSide + 4, 0);
  doc.addImage(qr, 'PNG', x0 + 2, y + 2, qrSide, qrSide);
  const ox = x0 + qrSide + 4 + pad;
  const ow = x0 + w - ox - pad;
  let oy = y + 6;
  cap('ORDER', ox, oy); oy += lineH(7.5 * s) + 1.2;
  oy += text(order.order_number || '', ox, oy + 2, 15, true) + 1.6;
  const details = [
    show.shipDate && d.shipDate && ['Date', d.shipDate],
    show.weight && d.weight && ['Weight', `${d.weight} kg`],
    show.dimensions && d.dimensions && ['Box', d.dimensions],
  ].filter(Boolean);
  details.forEach(([k, v]) => { oy += text(`${k}: ${v}`, ox, oy, 9, false, ow) + 0.4; });
  if (d.isCod) {
    oy += 1;
    doc.setLineWidth(0.5);
    const label = `COD - COLLECT Rs.${d.total.toFixed(0)}`;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10 * s);
    const bw = doc.getTextWidth(label) + 3;
    doc.rect(ox, oy - lineH(10 * s) + 0.6, bw, lineH(10 * s) + 1.4);
    doc.text(label, ox + 1.5, oy + 0.3);
    oy += lineH(10 * s) + 1;
  } else if (show.price && d.total > 0) {
    oy += text(`Order value Rs.${d.total.toFixed(0)}`, ox, oy, 9, true) + 0.4;
  }
  const topEnd = y + Math.max(topH, oy - y + 1);
  doc.setLineWidth(0.5);
  doc.line(x0 + qrSide + 4, y, x0 + qrSide + 4, topEnd);
  y = topEnd; rules.push(y);

  // --- deliver to
  let dy = y + 4;
  cap('DELIVER TO', x0 + pad, dy); dy += lineH(7.5 * s) + 1.4;
  dy += text(d.name, x0 + pad, dy + 1.5, 15, true, w - 2 * pad) + 1;
  if (d.address) dy += text(oneLineAddress(d.address), x0 + pad, dy + 1, 11, false, w - 2 * pad) + 0.6;
  if (d.pin) dy += text(`PIN ${d.pin}`, x0 + pad, dy + 2, 14, true) + 1;
  if (show.phone && d.phone) dy += text(`Ph: ${d.phone}`, x0 + pad, dy + 1.5, 12, true) + 0.5;
  y = dy + 1.5;

  // --- from | contents
  if (show.sender || show.contents) {
    rules.push(y);
    const half = w / 2;
    let fy = y + 3.6, cy = y + 3.6;
    if (show.sender) {
      cap('FROM', x0 + pad, fy); fy += lineH(7.5 * s) + 0.6;
      fy += text(company, x0 + pad, fy, 9.5, true, half - 2 * pad) + 0.2;
      fy += text(fromAddress, x0 + pad, fy, 8, false, half - 2 * pad);
      if (business.phone) fy += text(`Ph: ${business.phone}`, x0 + pad, fy, 8, false);
    }
    if (show.contents && d.contents) {
      const cx = show.sender ? x0 + half + pad : x0 + pad;
      const cw = show.sender ? half - 2 * pad : w - 2 * pad;
      cap('CONTENTS', cx, cy); cy += lineH(7.5 * s) + 0.6;
      cy += text(d.contents.replace(/×/g, 'x'), cx, cy, 8.5, false, cw);
    }
    const end = Math.max(fy, cy) + 0.6;
    if (show.sender && show.contents && d.contents) doc.line(x0 + half, y, x0 + half, end);
    y = end;
  }

  // --- return line
  if (show.returnAddress) {
    rules.push(y);
    const ret = `If undelivered, return to: ${company}, ${returnAddress}${business.phone ? ` - Ph: ${business.phone}` : ''}`;
    y += 3.4 + text(ret, x0 + pad, y + 3.4, 7.5, false, w - 2 * pad);
  }

  // box and dividers
  doc.setLineWidth(0.6);
  doc.rect(x0, M, w, y - M);
  doc.setLineWidth(0.5);
  rules.forEach(ry => doc.line(x0, ry, x0 + w, ry));
  return y; // bottom of the label
}

// orders: sales orders; overrides: per-order edits from the single-label window
export async function buildLabelPdf({ orders, settings, business, skus, size = '4x6', overrides = {} }) {
  const [W, H] = PAGES[size] || PAGES['4x6'];
  const doc = new jsPDF({ unit: 'mm', format: [W, H], orientation: 'portrait', compress: true });
  const show = settings?.show || {};
  const baseScale = settings?.fontScale || 1;
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (i > 0) doc.addPage([W, H], 'portrait');
    const d = labelData(order, overrides[order.id] || {}, skus);
    const qr = await QRCode.toDataURL(labelQrValue(order), { errorCorrectionLevel: 'M', margin: 1, scale: 12 });
    // Start a little larger and shrink until the label fits the sticker, so a
    // short address fills the page and a very long one still fits.
    let s = baseScale * 1.3;
    for (let tries = 0; tries < 16; tries++) {
      const probe = new jsPDF({ unit: 'mm', format: [W, H] });
      const bottom = drawCompact(probe, { order, d, show, business, qr, W, H, s });
      if (bottom <= H - 3 || s <= 0.6) break;
      s *= 0.95;
    }
    drawCompact(doc, { order, d, show, business, qr, W, H, s });
  }
  return doc;
}

// iPhone: opens the share sheet so the PDF goes straight to the printer's app
// (or Files / WhatsApp). Elsewhere, or if sharing isn't offered: downloads it.
// Returns 'needs-tap' when the phone refused to open the share sheet because
// making the PDF took too long after the tap; the screen then shows a button
// that shares it on the next tap.
export async function shareOrSavePdf(doc, fileName) {
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      if (err && err.name === 'NotAllowedError') return 'needs-tap';
    }
  }
  doc.save(fileName);
  return 'saved';
}
