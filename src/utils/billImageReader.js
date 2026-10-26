// Reads a bill photo or a UPI payment screenshot in the browser with
// Tesseract (free, open source; the image never leaves the phone). No paid AI.
//
// - UPI screenshots (Google Pay / PhonePe / Paytm / BHIM) are clean printed
//   text: amount, who was paid, date and the UPI reference are picked out.
//   The UPI reference is used as the bill number, so the duplicate-bill check
//   also stops the same payment being entered twice.
// - A photo of a printed bill goes through the same line reader as PDFs
//   (parseBillLines); whatever it can't read is left for her to type.
// Handwritten bills don't OCR reliably and are typed in as before.
import { parseBillLines } from './billPdfParser';

export async function readImageText(file, onProgress) {
  const { createWorker } = await import('tesseract.js'); // ~loaded only when a photo is uploaded
  const worker = await createWorker('eng', 1, {
    logger: (m) => { if (m.status === 'recognizing text' && onProgress) onProgress(m.progress); },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const toNum = (s) => parseFloat(String(s).replace(/[,\s]/g, '')) || 0;

function findDate(text) {
  const named = text.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+(\d{4})/i);
  if (named) return `${named[3]}-${String(MONTHS[named[2].toLowerCase().slice(0, 3)]).padStart(2, '0')}-${named[1].padStart(2, '0')}`;
  const num = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (num) return `${num[3].length === 2 ? '20' + num[3] : num[3]}-${num[2].padStart(2, '0')}-${num[1].padStart(2, '0')}`;
  return '';
}

const COURIER = /courier|st\s*courier|india\s*post|speed\s*post|delhivery|dtdc|professional|xpressbees|ekart|bluedart|shiprocket/i;

// Returns null when the text doesn't look like a UPI payment screenshot.
export function parseUpiScreenshot(text) {
  if (!/\bUPI\b|Google\s*Pay|G\s*Pay|PhonePe|Paytm|BHIM|UTR|Transaction\s*ID|Payment\s*(?:successful|completed)|Paid\s+to/i.test(text)) return null;
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);

  // Amount: a rupee figure (OCR often reads ₹ as %, X, Z or 2 before the digits)
  let amount = 0;
  const rupee = text.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (rupee) amount = toNum(rupee[1]);
  if (!amount) {
    for (const l of lines.slice(0, 12)) {
      const m = l.match(/^[₹%XZ]?\s*([\d,]{2,}(?:\.\d{2})?)$/);
      if (m) { amount = toNum(m[1]); break; }
    }
  }

  // UPI reference / UTR: 12 digits usually; Transaction IDs can be alphanumeric
  const ref = (text.match(/(?:UPI\s*(?:transaction\s*)?(?:ID|Ref(?:erence)?\.?\s*(?:No\.?)?)|UTR(?:\s*No\.?)?|Transaction\s*ID)\s*[:.]?\s*([A-Z0-9]{10,})/i) || [])[1]
    || (text.match(/\b(\d{12})\b/) || [])[1] || '';

  // Who was paid
  let payee = '';
  const to = text.match(/(?:Paid\s+to|Sent\s+to|To:?)\s*\n?\s*([A-Za-z][A-Za-z0-9 .&'-]{2,40})/);
  if (to) payee = to[1].replace(/\s+(?:Banking\s*name|UPI\s*ID).*$/i, '').trim();

  return {
    kind: 'upi',
    amount,
    payee,
    upiRef: ref,
    date: findDate(text),
    category: COURIER.test(text) ? 'shipping' : '',
  };
}

// Printed bill photo: OCR text -> the same line reader as PDFs.
export function parseBillPhoto(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const bill = parseBillLines(lines);
  if (!bill.total) {
    const t = text.match(/(?:Grand\s*)?Total\s*(?:Amount)?\s*[:₹Rs.]*\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (t) bill.total = toNum(t[1]);
  }
  return bill;
}
