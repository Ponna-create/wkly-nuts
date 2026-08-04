// Turns raw OCR text off a courier slip photo into a best-guess match against
// open orders. Phone number is the strongest signal (unique, easy to
// validate) — trust it directly. Name matching is fuzzy and shown as a
// suggestion only, never auto-committed; the seller still taps to confirm.

// Same pattern as extractPhone in orderPasteParser.js — Indian mobiles start 6-9.
export function extractPhoneFromText(text) {
  const candidates = text.match(/(?:\+?91[ -]?)?\d[\d -]{7,13}\d/g) || [];
  for (const raw of candidates) {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  }
  return null;
}

// Consignment numbers on these slips are 11-12 plain digits, printed under
// the barcode — deliberately excludes 10-digit runs since ST Courier's
// numbers happen to start with 6-9 too (same prefix range as a phone
// number), so length is the only reliable way to tell them apart.
export function extractTrackingFromText(text) {
  const candidates = text.match(/\b\d{11,12}\b/g) || [];
  return candidates[0] || null;
}

// Courier slip's own printed/handwritten date (DD/MM or DD/MM/YY next to
// "DATE") — kept separate from order_date/dispatch_date since it's what the
// courier actually wrote down, not what we recorded in-app.
export function extractSlipDateFromText(text) {
  const match = text.match(/DATE[^\d]{0,6}(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/i);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = d.padStart(2, '0');
  const month = m.padStart(2, '0');
  if (Number(day) > 31 || Number(month) > 12) return null;
  let year = y ? (y.length === 2 ? `20${y}` : y) : String(new Date().getFullYear());
  return `${year}-${month}-${day}`;
}

// Weight in KG, printed just above/near the "KG." label on ST Courier slips.
export function extractWeightFromText(text) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*KG/i);
  return match ? parseFloat(match[1].replace(',', '.')) : null;
}

// Cash/Credit amount box on the slip — the shipping charge the courier
// collected, not necessarily what we charged the customer in-app.
export function extractAmountFromText(text) {
  const match = text.match(/(?:Cash|Credit)[^\d]{0,4}(\d{2,5})/i) || text.match(/₹\s?(\d{2,5})/);
  return match ? parseFloat(match[1]) : null;
}

// Normalized Levenshtein similarity, 0 (no match) to 1 (identical).
function similarity(a, b) {
  const s1 = (a || '').toLowerCase().trim();
  const s2 = (b || '').toLowerCase().trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = s1[i - 1] === s2[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const distance = dp[m][n];
  return 1 - distance / Math.max(m, n);
}

// Best guess at which order a slip belongs to. Tries phone first (high
// confidence — a phone number is unique); falls back to fuzzy name matching,
// boosted by a pincode hit (both signals present on the order already, no
// need to re-key them off the slip) against the OCR'd text.
export function findBestOrderMatch(ocrText, candidateOrders) {
  const trackingNumber = extractTrackingFromText(ocrText);
  const slipDate = extractSlipDateFromText(ocrText);
  const weight = extractWeightFromText(ocrText);
  const amount = extractAmountFromText(ocrText);
  const guessedName = extractLikelyNameLine(ocrText);
  const extracted = { trackingNumber, slipDate, weight, amount, guessedName };

  const phone = extractPhoneFromText(ocrText);
  if (phone) {
    const match = candidateOrders.find(o => (o.phone || '').replace(/\D/g, '').slice(-10) === phone);
    if (match) return { order: match, confidence: 1, matchedVia: 'phone', bestCandidate: match, ...extracted };
  }

  const lowerText = ocrText.toLowerCase();
  let best = null;
  for (const order of candidateOrders) {
    const name = order.customer_name || '';
    if (!name) continue;
    // Direct substring hit (name appears verbatim somewhere in the OCR text)
    // beats fuzzy scoring — common for cleanly printed names.
    const directHit = lowerText.includes(name.toLowerCase());
    let score = directHit ? 1 : similarity(name, guessedName);
    // Pincode already on the order (from the customer record) appearing
    // anywhere in the OCR text is a strong secondary signal — bump a
    // decent name match up to auto-link territory instead of making her
    // confirm something that's actually a solid match.
    const pincode = String(order.shipping_pincode || order.pincode || '').trim();
    if (pincode && pincode.length >= 5 && ocrText.includes(pincode)) {
      score = Math.min(1, score + 0.25);
    }
    if (!best || score > best.score) best = { order, score };
  }

  // bestCandidate is returned even below the confirm threshold — the review
  // list still shows "closest guess: X (32%)" so she can tell at a glance
  // whether it's a bad OCR read or genuinely not in the order list, instead
  // of just "no match" with nothing to go on.
  if (best && best.score >= 0.6) {
    return { order: best.order, confidence: best.score, matchedVia: 'name', bestCandidate: best.order, ...extracted };
  }
  return { order: null, confidence: best?.score || 0, matchedVia: null, bestCandidate: best?.order || null, ...extracted };
}

// Heuristic: the "To" name on these slips is usually a short line (1-3
// words), not a sentence — take the shortest non-numeric line as a guess.
export function extractLikelyNameLine(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const nameLines = lines.filter(l => l.length > 1 && l.length < 30 && !/\d{4,}/.test(l));
  if (nameLines.length === 0) return '';
  return nameLines.reduce((a, b) => (a.length <= b.length ? a : b));
}
