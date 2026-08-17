// Reads an Amazon "Tax Invoice" PDF entirely client-side — no server, no API,
// no cost. Amazon's invoices are digitally generated (not scanned photos),
// so the text is already embedded in the file; this pulls it out and
// pattern-matches Amazon's fixed label format ("Order Number:", "HSN:",
// "Shipping Address :", etc.) rather than guessing at pixels the way an
// OCR/vision model would.
//
// Tested against real invoices before relying on it: Amazon's PDF has a
// two-column layout (Sold-by / Billing-address, then Shipping-address next
// to the seller's own PAN/GST/FSSAI block) that interleaves unpredictably
// when read back as plain text — lines from both columns land side by side
// out of visual order. The patterns below were written against that actual
// jumbled output, not a clean assumption, and specifically DO NOT trust the
// extracted HSN code on its own — on one real invoice a nutrition-label
// fragment corrupted "1204" into "160KCal" in the raw text. HSN instead
// comes from matching the item name to a known SKU (which already has the
// auditor-confirmed code); only a genuinely unrecognized product falls back
// to whatever HSN text was found, flagged for manual check. Never
// auto-submits — the caller always shows parsed fields for review first.
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

async function extractPdfLines(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const byY = new Map();
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]); // baseline Y, rounded to bucket same-line fragments
      const bucket = byY.get(y) || [];
      bucket.push({ x: item.transform[4], text: item.str });
      byY.set(y, bucket);
    });
    const sortedY = [...byY.keys()].sort((a, b) => b - a); // descending Y = top-to-bottom
    sortedY.forEach(y => {
      const line = byY.get(y).sort((a, b) => a.x - b.x).map(f => f.text).join(' ').replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
    });
  }
  return lines;
}

export async function extractAmazonInvoiceText(file) {
  return (await extractPdfLines(file)).join('\n');
}

// Known products with their auditor-confirmed HSN — used to override
// whatever (possibly-corrupted) HSN the PDF text yields. Keep this in sync
// with SKU Management's own HSN fields if those ever change.
const KNOWN_PRODUCTS = [
  { match: /seed/i, name: 'Seed Cycle', hsn: '1204' },
  { match: /weekly pack|day pack/i, name: 'Day Pack', hsn: '2008 19 20' },
  { match: /soak|night/i, name: 'Night Soak', hsn: '2008 19 20' },
  { match: /mexican/i, name: 'Mexican Bites', hsn: '2106' },
  { match: /party mix/i, name: 'Party Mix', hsn: '2106' },
];

function titleCase(s) {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function parseAmazonInvoice(text) {
  const grab = (re) => { const m = text.match(re); return m ? m[1].trim() : null; };

  const orderNumber = grab(/Order Number\s*:?\s*(\d{3}-\d{7}-\d{7})/i);
  const orderDateRaw = grab(/Order Date\s*:?\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  const orderDateMatch = text.match(/Order Date\s*:?\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  const orderDate = orderDateMatch ? `${orderDateMatch[3]}-${orderDateMatch[2]}-${orderDateMatch[1]}` : null;
  const invoiceNumber = grab(/Invoice Number\s*:\s*(\S+)/i);
  const paymentMode = grab(/Mode of Payment\s*:?\s*([A-Za-z ]+?)(?:\n|$)/i);
  const invoiceTotal = grab(/Invoice Value\s*:?\s*([\d,]+\.\d{2})/i);
  const placeOfDelivery = grab(/Place of delivery\s*:?\s*([A-Za-z ]+?)(?:\n|$)/i);

  // --- Customer name/address from the Shipping Address block ---
  // Cut everything between "Shipping Address :" and the LAST "State/UT Code:"
  // in the document (there are two — billing then shipping — the shipping
  // one is always the second/closer one since it's printed right after).
  let name = null, address = null, city = null, state = null, pincode = null;
  const shipIdx = text.search(/Shipping Address\s*:/i);
  if (shipIdx !== -1) {
    const after = text.slice(shipIdx);
    const stateCodeIdx = after.search(/State\/UT Code\s*:/i);
    const block = (stateCodeIdx !== -1 ? after.slice(0, stateCodeIdx) : after)
      .split('\n').map(l => l.trim()).filter(Boolean)
      // Drop the "Shipping Address :" header itself and seller boilerplate
      // that lands in this range purely from column interleaving.
      .filter(l => !/^Shipping Address/i.test(l))
      .filter(l => !/PAN No|GST Registration|FSSAI License/i.test(l))
      .filter(l => !/^\d{9,}$/.test(l)) // stray license/GSTIN numbers with no label
      .filter(l => !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$/.test(l)) // GSTIN pattern
      .filter(l => l.toUpperCase() !== 'IN');

    const cityLine = block.find(l => /,\s*[A-Za-z ]+,?\s*\d{6}/.test(l));
    const cityIdx = cityLine ? block.indexOf(cityLine) : -1;
    // Name lines: consecutive lines with no digits, before the first line
    // that has one (street addresses always contain a house/door number).
    // Amazon prints the name twice (short then full) — take the longest.
    const firstDigitIdx = block.findIndex(l => /\d/.test(l));
    const nameLines = block.slice(0, firstDigitIdx === -1 ? 0 : firstDigitIdx);
    name = nameLines.length ? nameLines.reduce((a, b) => (b.length > a.length ? b : a)) : (block[0] || null);
    const addrStart = nameLines.length;
    address = block.slice(addrStart, cityIdx > 0 ? cityIdx : undefined).join(', ') || null;

    if (cityLine) {
      const m = cityLine.match(/(.+?),\s*([A-Za-z ]+?),?\s*(\d{6})/);
      if (m) { city = m[1].trim(); state = titleCase(m[2].trim()); pincode = m[3].trim(); }
    }
  }
  // Place of delivery is a single clean line — more reliable than the
  // jumbled address block for state specifically; prefer it when present.
  if (placeOfDelivery) state = titleCase(placeOfDelivery);

  // --- Line items ---
  // Anchor on "HSN:" occurrences, not "WKLY NUTS" — that phrase also shows
  // up in the seller header ("Sold By : WKLY NUTS") and signature footer
  // ("For WKLY NUTS:"), which aren't items and were throwing the count off.
  // HSN only ever appears once per real product line.
  const priceRowRe = /₹\s?([\d,]+\.\d{2})\s+(\d+)\s+₹\s?([\d,]+\.\d{2})\s+[\d.]+%\s+₹\s?([\d,]+\.\d{2})\s+₹\s?([\d,]+\.\d{2})/g;
  const allPriceRows = [...text.matchAll(priceRowRe)];
  const productNameMatches = [...text.matchAll(/WKLY NUTS\s+([^|]+)/gi)]
    .filter(m => !/^For\b/i.test(text.slice(Math.max(0, m.index - 10), m.index))); // drop the "For WKLY NUTS:" signature
  const hsnMatches = [...text.matchAll(/HSN\s*:\s*(\S+)/gi)];

  const items = hsnMatches.map((hsnMatch, i) => {
    // Nearest product-name match that comes BEFORE this HSN (its own item's name).
    const candidateNames = productNameMatches.filter(m => m.index < hsnMatch.index);
    const rawName = candidateNames.length ? candidateNames[candidateNames.length - 1][1].trim() : null;
    const known = KNOWN_PRODUCTS.find(p => p.match.test(rawName || ''));
    const hsnFromText = hsnMatch[1];
    const hsnLooksValid = /^\d{4,8}$/.test(hsnFromText);
    const row = allPriceRows[i]; // nth price row belongs to nth item, same left-to-right order as HSN codes
    return {
      name: known ? known.name : (rawName || 'Unknown'),
      hsnCode: known ? known.hsn : (hsnLooksValid ? hsnFromText : null),
      hsnNeedsVerification: !known && !hsnLooksValid,
      unitPrice: row ? parseFloat(row[1].replace(/,/g, '')) : null,
      quantity: row ? parseInt(row[2], 10) : null,
      total: row ? parseFloat(row[5].replace(/,/g, '')) : null,
    };
  });

  // --- Shipping (sum every "Shipping Charges" row — one per item on
  // multi-item invoices) ---
  const shippingRe = /Shipping Charges[\s\S]{0,10}?₹\s?([\d,]+\.\d{2})\s+₹\s?([\d,]+\.\d{2})\s+[\d.]+%\s+₹\s?([\d,]+\.\d{2})\s+₹\s?([\d,]+\.\d{2})/g;
  let shippingCharge = 0;
  let sm;
  while ((sm = shippingRe.exec(text)) !== null) shippingCharge += parseFloat(sm[4].replace(/,/g, ''));

  return {
    orderNumber, orderDate, invoiceNumber, paymentMode,
    invoiceTotal: invoiceTotal ? parseFloat(invoiceTotal.replace(/,/g, '')) : null,
    shippingCharge: shippingCharge || null,
    customer: { name, address, city, state, pincode },
    items,
  };
}
