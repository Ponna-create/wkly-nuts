// Reads a supplier bill / estimate PDF entirely in the browser — no server, no
// cost. Billing apps (Vyapar, myBillBook, Zoho) produce PDFs with the text
// embedded, so the numbers come out exactly instead of being "read" by a model.
// Never saves anything: the caller shows the parsed fields for her to check.
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfLines(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const byY = new Map();
    content.items.forEach(item => {
      if (!item.str || !item.str.trim()) return;
      const y = Math.round(item.transform[5]);
      const bucket = byY.get(y) || [];
      bucket.push({ x: item.transform[4], text: item.str });
      byY.set(y, bucket);
    });
    [...byY.keys()].sort((a, b) => b - a).forEach(y => {
      const text = byY.get(y).sort((a, b) => a.x - b.x).map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    });
  }
  return lines;
}

const toNum = (s) => parseFloat(String(s).replace(/,/g, '')) || 0;

// Stock is kept in kg (ingredients) or pieces (packaging). A bill line's
// quantity is converted to that: grams -> kg; pieces/packs of a named weight
// ("Almonds 500 g", 4 Pcs) -> kg; pieces with no weight stay pieces and are
// flagged so the quantity gets checked rather than saved as kg.
function normaliseQty(name, qty, unitRaw) {
  const unit = String(unitRaw || '').toLowerCase();
  if (/^(kg|kgs)$/.test(unit)) return { name, qty, unit: 'Kg' };
  if (/^(gm|gms|g)$/.test(unit)) return { name, qty: Math.round((qty / 1000) * 1000) / 1000, unit: 'Kg' };
  if (/^(ltr|litre)$/.test(unit)) return { name, qty, unit: 'Ltr' };
  const pack = name.match(/\s*-?\s*(\d+(?:\.\d+)?)\s*(kg|kgs|gm|gms|g)\s*$/i);
  if (pack) {
    const n = toNum(pack[1]);
    const packKg = pack[2].toLowerCase().startsWith('k') ? n : n / 1000;
    return { name: name.slice(0, pack.index).trim(), qty: Math.round(qty * packKg * 1000) / 1000, unit: 'Kg' };
  }
  return { name, qty, unit: 'Pcs', qtyNote: `${qty} ${unitRaw} on the bill: enter the weight in kg if this is an ingredient` };
}
const TITLES = /^(estimate|invoice|tax invoice|bill|proforma invoice|bill of supply|purchase|cash memo|quotation)$/i;

function toIsoDate(s) {
  const m = String(s || '').match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (!m) return '';
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// lines: array of text lines from the PDF. Returns what could be read; any
// missing field is left empty so the form simply asks for it.
export function parseBillLines(lines) {
  const text = lines.join(' ').replace(/\s+/g, ' ');
  const out = { vendor: '', billNo: '', date: '', items: [], total: 0, roundOff: 0 };

  // Header block = everything above "Bill To" / the item table. Billing apps put
  // labels ("Invoice No.", "Date") in one row and the values ("423", "05-10-2026")
  // in the row below, so the values are found by shape, not by label.
  const head = text.split(/Bill\s*To|#\s*Item\s*Name|S\.?\s*No\s+HSN/i)[0];
  const DATE = /(?<![\d/.-])\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(?![\d/-])/g;
  const LABEL_WORDS = /^(date|no|no\.|invoice|due|bill|estimate|number|phone|tax|of|supply)$/i;

  // invoice date: first date in the header that is not the due date
  let dateHit = null;
  for (const dm of head.matchAll(DATE)) {
    const before = head.slice(Math.max(0, dm.index - 12), dm.index);
    if (/due\s*date\s*:?\s*$/i.test(before)) continue;
    dateHit = dm; break;
  }
  if (dateHit) {
    out.date = toIsoDate(dateHit[0]);
    const pre = head.slice(0, dateHit.index).trim().split(/\s+/);
    const last = pre[pre.length - 1];
    if (last && !LABEL_WORDS.test(last) && /[0-9]/.test(last)) out.billNo = last;
  }
  if (!out.billNo) {
    const no = text.match(/(?:Invoice|Bill|Estimate|Receipt)\s*(?:No|Number|#)\.?\s*:?\s*([A-Za-z0-9/-]*\d[A-Za-z0-9/-]*)/i);
    if (no) out.billNo = no[1];
  }

  // vendor: what's left of the header once titles, labels, numbers and dates are removed
  let v = head
    .replace(/Phone\s*no\.?\s*:?\s*\d*/gi, ' ')
    .replace(/Due\s*Date/gi, ' ')
    .replace(/Invoice\s*No\.?/gi, ' ')
    .replace(/\b(?:Date|Estimate|Tax Invoice|Invoice|Bill of Supply|Proforma Invoice|Cash Memo|Quotation)\b/gi, ' ')
    .replace(DATE, ' ');
  if (out.billNo) v = v.replace(out.billNo, ' ');
  v = v.replace(/\s+/g, ' ').trim();
  const footer = text.match(/For\s*:?\s*([A-Z][A-Za-z0-9 &.'-]{2,40}?)\s+Authori[sz]ed/);
  if (footer) {
    out.vendor = footer[1].trim();
  } else if (v.length >= 2 && v.length <= 60 && !/(?:Mrs?|Ms|Bank|Account|Bill To|IFSC)\b/i.test(v)) {
    out.vendor = v;
  }
  if (!out.vendor) {
    const m = text.match(/For:\s*([A-Za-z0-9 &.'-]{2,40}?)(?:\s+Authori[sz]ed|$)/);
    if (m) out.vendor = m[1].trim();
  }
  out.isProforma = /Proforma/i.test(text);

  const rowRe = /(\d+)\s+([A-Za-z][^₹]*?)\s+(\d+(?:[.,]\d+)?)\s*(Kg|Kgs|Gm|Gms|g|Ltr|Litre|Pcs|Pc|Nos|Packs?|Box(?:es)?)\s+₹\s*([\d,]+(?:\.\d+)?)\s+₹\s*([\d,]+(?:\.\d+)?)/gi;
  // only look below the table header, so invoice no. / date digits can't be mistaken for a row
  const body = text.replace(/^[\s\S]*?Item\s*Name\s*Quantity[\s\S]*?Amount\s+(?=\d)/i, '');
  let m;
  while ((m = rowRe.exec(body)) !== null) {
    out.items.push({
      ...normaliseQty(m[2].trim(), toNum(m[3]), m[4]),
      rate: toNum(m[5]),
      amount: toNum(m[6]),
    });
  }

  const totals = [...text.matchAll(/(?<!Sub\s)Total\s*₹\s*([\d,]+(?:\.\d+)?)/gi)];
  if (totals.length) out.total = toNum(totals[totals.length - 1][1]);
  const ro = text.match(/Round\s*off\s*([-+])?\s*₹\s*([\d,.]+)/i);
  if (ro) out.roundOff = (ro[1] === '-' ? -1 : 1) * toNum(ro[2]);
  // Layout B: "S.No HSN Description GST% Qty Rate Amount" (amounts are BEFORE GST; GST is added below)
  if (out.items.length === 0) {
    const rowB = /(\d{1,3})\s+(\d{4,8})\s+(.+?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)(?=\s+\d{1,3}\s+\d{4,8}\s|\s+Total|$)/g;
    const tableText = text.replace(/^[\s\S]*?Description\s+GST\s*%\s+Qty\s+Rate\s+Amount\s*/i, '');
    let gstSum = 0;
    let mb;
    while ((mb = rowB.exec(tableText)) !== null) {
      let name = mb[3].trim();
      let packKg = 1;
      const pack = name.match(/\s*-?\s*(\d+(?:\.\d+)?)\s*(kg|kgs|gm|gms|g)\s*$/i);
      if (pack) {
        const n = toNum(pack[1]);
        packKg = pack[2].toLowerCase().startsWith('k') ? n : n / 1000;
        name = name.slice(0, pack.index).trim();
      }
      const packs = toNum(mb[5]);
      const gstPct = toNum(mb[4]);
      const base = toNum(mb[7]);
      gstSum += (base * gstPct) / 100;
      out.items.push({ name, qty: Math.round(packs * packKg * 1000) / 1000, unit: 'Kg', rate: toNum(mb[6]), amount: base, gstPct });
    }
    if (out.items.length > 0) {
      out.gstAmount = Math.round(gstSum * 100) / 100;
      const bp = text.match(/Balance\s*Payable\s*([\d,]+(?:\.\d+)?)/i);
      if (bp) out.total = toNum(bp[1]);
      const rof = text.match(/Round\s*Off\s*(-?\s*[\d.]+)/i);
      if (rof) out.roundOff = toNum(rof[1].replace(/\s/g, ''));
    }
  }
  return out;
}

export async function parseBillPdf(file) {
  const lines = await extractPdfLines(file);
  return parseBillLines(lines);
}
