import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { getBusinessInfo, getLabelSettings } from './settings.js';
import { labelQrValue } from './labelPrint.js';

// Prints multiple shipping labels on a single A4 sheet — for printers that
// aren't thermal/sticker printers. Cut along the dashed lines, paste onto
// each box. 4 per sheet (2 x 2, near 4x6 size) or 6 per sheet (2 x 3),
// chosen in Settings > Shipping Label; optionally with a QR code holding the
// order number so A4 labels can be scanned at hand-over too.
//
// A4 keeps its own simple style (big To block, small From block, order line)
// rather than the thermal templates: the thermal layouts are built for a
// 4-inch strip, this one for a cut-out on plain paper.
const MARGIN = 8, GAP = 4;
const PAGE_W = 210, PAGE_H = 297;

// Font sizes in pt, offsets and QR side in mm.
export const A4_LAYOUTS = {
  6: { cols: 2, rows: 3, name: 15, addr: 9.5, phone: 10.5, fromName: 11.5, fromAddr: 9, fromPhone: 9.5, orderSize: 9.5, itemSize: 9, orderOffset: 69, qr: 18 },
  4: { cols: 2, rows: 2, name: 19, addr: 12, phone: 13, fromName: 12.5, fromAddr: 10, fromPhone: 10.5, orderSize: 11, itemSize: 10, orderOffset: 100, qr: 28 },
};
export const a4LayoutFor = (perSheet) => A4_LAYOUTS[perSheet] || A4_LAYOUTS[6];
export const a4CellSize = (L) => ({
  w: (PAGE_W - 2 * MARGIN - (L.cols - 1) * GAP) / L.cols,
  h: (PAGE_H - 2 * MARGIN - (L.rows - 1) * GAP) / L.rows,
});

export function itemsSummary(order) {
  return (order.items || [])
    .map(i => `${i.quantity}x ${i.sku_name || i.skuName} (${i.pack_type || i.packType})`)
    .join(', ') || 'No items';
}

function drawLabel(doc, x, y, w, h, order, business, L, qrDataUrl) {
  const pad = 4.5;
  const innerW = w - 2 * pad;

  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(154, 151, 145);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);
  doc.setLineDashPattern([], 0);

  let cy = y + pad + 3;

  const blockLabel = (text) => {
    doc.setFont(undefined, 'bold'); doc.setFontSize(7); doc.setTextColor(85, 85, 85);
    doc.text(text.toUpperCase(), x + pad, cy);
    cy += 5.5;
  };
  const nameLine = (text, size) => {
    doc.setFont(undefined, 'bold'); doc.setFontSize(size); doc.setTextColor(17, 17, 17);
    doc.text(text, x + pad, cy);
    cy += size * 0.4 + 2.2;
  };
  const addrLines = (text, size) => {
    doc.setFont(undefined, 'normal'); doc.setFontSize(size); doc.setTextColor(34, 34, 34);
    const lines = doc.splitTextToSize(text || '—', innerW);
    lines.forEach(line => { doc.text(line, x + pad, cy); cy += size * 0.42 + 1.2; });
  };
  const phoneLine = (text, size) => {
    doc.setFont(undefined, 'bold'); doc.setFontSize(size); doc.setTextColor(17, 17, 17);
    doc.text('Ph: ' + (text || '—'), x + pad, cy);
    cy += size * 0.42 + 1.8;
  };
  const divider = () => {
    doc.setDrawColor(187, 187, 187); doc.setLineWidth(0.15);
    doc.line(x + pad, cy, x + w - pad, cy);
    cy += 2.6;
  };

  // TO
  blockLabel('To');
  nameLine(order.customer_name || 'Customer', L.name);
  addrLines(order.shipping_address, L.addr);
  phoneLine(order.courier_number || order.phone, L.phone);

  divider();

  // FROM — full registered address (Settings > Business Info), not just city
  blockLabel('From');
  nameLine(business.companyName || 'WKLY Nuts', L.fromName);
  addrLines(business.registeredAddress || 'Chennai, Tamil Nadu', L.fromAddr);
  phoneLine(business.phone, L.fromPhone);

  // Order block — pinned to a fixed offset from the top of the label so
  // every label on the sheet lines up at the same height (a short address
  // used to leave this floating much higher than a long one, making the
  // whole sheet look unaligned). Only overridden — pushed further down —
  // for an address long enough that the fixed position would actually
  // collide with it; that's the rare case, not the common one.
  const orderTop = Math.max(cy - 1.5, y + L.orderOffset);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  doc.line(x + pad, orderTop, x + w - pad, orderTop);

  // QR sits in the bottom-right corner; the order text wraps beside it.
  const textW = qrDataUrl ? innerW - L.qr - 3 : innerW;
  if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', x + w - pad - L.qr, y + h - pad - L.qr, L.qr, L.qr);

  doc.setFont(undefined, 'bold'); doc.setFontSize(L.orderSize); doc.setTextColor(17, 17, 17);
  doc.text(order.order_number || '', x + pad, orderTop + 4.6);

  doc.setFont(undefined, 'normal'); doc.setFontSize(L.itemSize); doc.setTextColor(34, 34, 34);
  const itemLines = doc.splitTextToSize(itemsSummary(order), textW);
  let iy = orderTop + 4.6 + L.itemSize * 0.5;
  itemLines.forEach(line => { doc.text(line, x + pad, iy); iy += L.itemSize * 0.43; });
}

// orders: array of sales_order rows (snake_case, as returned by dbService.getSalesOrders)
export async function generateA4LabelSheet(orders) {
  if (!orders || orders.length === 0) return;
  const business = getBusinessInfo();
  const settings = getLabelSettings();
  const L = a4LayoutFor(settings.a4PerSheet);
  const { w, h } = a4CellSize(L);
  const perPage = L.cols * L.rows;
  const qrs = settings.a4Qr
    ? await Promise.all(orders.map(o => QRCode.toDataURL(labelQrValue(o), { errorCorrectionLevel: 'M', margin: 1, scale: 10 })))
    : [];
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  orders.forEach((order, idx) => {
    const posInPage = idx % perPage;
    if (idx > 0 && posInPage === 0) doc.addPage();
    const row = Math.floor(posInPage / L.cols);
    const col = posInPage % L.cols;
    const x = MARGIN + col * (w + GAP);
    const y = MARGIN + row * (h + GAP);
    drawLabel(doc, x, y, w, h, order, business, L, qrs[idx]);
  });

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`WKLY-Nuts-Labels-A4-${dateStr}.pdf`);
}
