// Shared shipping-label print settings for LabelPrinter and BulkLabelPrint.
//
// The QR on a label holds ONLY the order number (e.g. "SO-2026-00352").
// It used to hold the whole order as JSON (id, customer, tracking, total) or
// the 36-character order id, squeezed into ~2 cm — far too dense for a
// thermal printer, so it rarely scanned. A short value makes a coarse QR
// (21x21 modules) that prints with big, crisp squares at the same size.

// Thermal sizes are portrait, 4 inches wide. The old page was 152x102mm
// (6x4 landscape), which a 4x5 printer shrank to fit, shrinking the QR too.
export const LABEL_SIZES = {
  '4x5': { name: '4×5', width: '101.6mm', height: '127mm' },
  '4x6': { name: '4×6', width: '101.6mm', height: '152.4mm' },
  a4: { name: 'A4', width: '210mm', height: '297mm' },
};

const STORAGE_KEY = 'wkly.labelSize';

// Remembered per device — the printer is attached to the device, not the account.
export function getSavedLabelSize(fallback) {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && LABEL_SIZES[v]) return v;
  } catch (e) { /* storage blocked: use the fallback */ }
  return LABEL_SIZES[fallback] ? fallback : '4x5';
}

export function saveLabelSize(size) {
  try { localStorage.setItem(STORAGE_KEY, size); } catch (e) { /* ignore */ }
}

export const labelQrValue = (order) => order.order_number || order.id;

// Opens the print window for one or more `.label-page` blocks. A label that
// is taller than the page (very long address) is scaled down to fit instead
// of spilling its QR onto a second sticker.
export function printLabels({ title, html, size }) {
  const page = LABEL_SIZES[size] || LABEL_SIZES['4x5'];
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: ${page.width} ${page.height}; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: ${page.width}; }
          body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .label-page { width: ${page.width}; height: ${page.height}; overflow: hidden; page-break-after: always; break-after: page; }
          .label-page:last-child { page-break-after: avoid; break-after: avoid; }
          svg { shape-rendering: crispEdges; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.document.querySelectorAll('.label-page').forEach(pageEl => {
      const inner = pageEl.firstElementChild;
      if (!inner) return;
      const cs = printWindow.getComputedStyle(pageEl);
      const availH = pageEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const availW = pageEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const scale = Math.min(1, availH / inner.scrollHeight, availW / inner.scrollWidth);
      if (scale < 1) inner.style.zoom = String(Math.floor(scale * 100) / 100);
    });
    printWindow.print();
    printWindow.close();
  }, 400);
  return true;
}
