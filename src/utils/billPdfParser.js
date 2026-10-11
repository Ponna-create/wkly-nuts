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

  const titleIdx = lines.findIndex(l => TITLES.test(l.trim()));
  if (titleIdx >= 0) {
    const cand = lines.slice(titleIdx + 1).find(l => l && !TITLES.test(l) && !/^phone|^ph\b|^gst|^address/i.test(l));
    if (cand) out.vendor = cand.trim();
  }
  if (!out.vendor) {
    const m = text.match(/For:\s*([A-Za-z0-9 &.'-]{2,40}?)(?:\s+Authori[sz]ed|$)/);
    if (m) out.vendor = m[1].trim();
  }

  const no = text.match(/(?:Invoice|Bill|Estimate|Receipt)\s*(?:No|Number|#)\.?\s*:?\s*([A-Za-z0-9/-]+)/i);
  if (no) out.billNo = no[1];

  const dt = text.match(/(?<!Due\s)(?<!Due\s\s)Date\s*:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i);
  if (dt) out.date = toIsoDate(dt[1]);

  const rowRe = /(\d+)\s+([A-Za-z][^₹]*?)\s+(\d+(?:[.,]\d+)?)\s*(Kg|Kgs|Gm|Gms|g|Ltr|Litre|Pcs|Pc|Nos|Packs?|Box(?:es)?)\s+₹\s*([\d,]+(?:\.\d+)?)\s+₹\s*([\d,]+(?:\.\d+)?)/gi;
  // only look below the table header, so invoice no. / date digits can't be mistaken for a row
  const body = text.replace(/^[\s\S]*?Item\s*Name\s*Quantity[\s\S]*?Amount\s+(?=\d)/i, '');
  let m;
  while ((m = rowRe.exec(body)) !== null) {
    out.items.push({
      name: m[2].trim(),
      qty: toNum(m[3]),
      unit: m[4],
      rate: toNum(m[5]),
      amount: toNum(m[6]),
    });
  }

  const totals = [...text.matchAll(/(?<!Sub\s)Total\s*₹\s*([\d,]+(?:\.\d+)?)/gi)];
  if (totals.length) out.total = toNum(totals[totals.length - 1][1]);
  const ro = text.match(/Round\s*off\s*([-+])?\s*₹\s*([\d,.]+)/i);
  if (ro) out.roundOff = (ro[1] === '-' ? -1 : 1) * toNum(ro[2]);
  return out;
}

export async function parseBillPdf(file) {
  const lines = await extractPdfLines(file);
  return parseBillLines(lines);
}
