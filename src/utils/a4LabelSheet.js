import jsPDF from 'jspdf';
import { getBusinessInfo } from './settings.js';

// Prints multiple shipping labels on a single A4 sheet — for printers that
// aren't thermal/sticker printers. Cut along the dashed lines, paste onto
// each box. 2 columns x 3 rows = 6 labels per sheet.
const MARGIN = 8, GAP = 4, COLS = 2, ROWS = 3;
const PAGE_W = 210, PAGE_H = 297;
const LABEL_W = (PAGE_W - 2 * MARGIN - (COLS - 1) * GAP) / COLS;
const LABEL_H = (PAGE_H - 2 * MARGIN - (ROWS - 1) * GAP) / ROWS;
const PER_PAGE = COLS * ROWS;

function itemsSummary(order) {
  return (order.items || [])
    .map(i => `${i.quantity}x ${i.sku_name || i.skuName} (${i.pack_type || i.packType})`)
    .join(', ') || 'No items';
}

function drawLabel(doc, x, y, w, h, order, business) {
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
  nameLine(order.customer_name || 'Customer', 15);
  addrLines(order.shipping_address, 9.5);
  phoneLine(order.phone, 10.5);

  divider();

  // FROM — full registered address (Settings > Business Info), not just city
  blockLabel('From');
  nameLine(business.companyName || 'WKLY Nuts', 11.5);
  addrLines(business.registeredAddress || 'Chennai, Tamil Nadu', 9);
  phoneLine(business.phone, 9.5);

  // Order block — pinned to a fixed offset from the top of the label so
  // every label on the sheet lines up at the same height (a short address
  // used to leave this floating much higher than a long one, making the
  // whole sheet look unaligned). Only overridden — pushed further down —
  // for an address long enough that the fixed position would actually
  // collide with it; that's the rare case, not the common one.
  const FIXED_ORDER_OFFSET = 69;
  const orderTop = Math.max(cy - 1.5, y + FIXED_ORDER_OFFSET);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
  doc.line(x + pad, orderTop, x + w - pad, orderTop);

  doc.setFont(undefined, 'bold'); doc.setFontSize(9.5); doc.setTextColor(17, 17, 17);
  doc.text(order.order_number || '', x + pad, orderTop + 4.6);

  doc.setFont(undefined, 'normal'); doc.setFontSize(9); doc.setTextColor(34, 34, 34);
  const itemLines = doc.splitTextToSize(itemsSummary(order), innerW);
  let iy = orderTop + 9.2;
  itemLines.forEach(line => { doc.text(line, x + pad, iy); iy += 3.9; });
}

// orders: array of sales_order rows (snake_case, as returned by dbService.getSalesOrders)
export function generateA4LabelSheet(orders) {
  if (!orders || orders.length === 0) return;
  const business = getBusinessInfo();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  orders.forEach((order, idx) => {
    const posInPage = idx % PER_PAGE;
    if (idx > 0 && posInPage === 0) doc.addPage();
    const row = Math.floor(posInPage / COLS);
    const col = posInPage % COLS;
    const x = MARGIN + col * (LABEL_W + GAP);
    const y = MARGIN + row * (LABEL_H + GAP);
    drawLabel(doc, x, y, LABEL_W, LABEL_H, order, business);
  });

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`WKLY-Nuts-Labels-A4-${dateStr}.pdf`);
}
