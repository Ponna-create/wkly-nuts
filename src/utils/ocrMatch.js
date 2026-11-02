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
  return candidates.find(isValidTracking) || candidates[0] || null;
}

export const cleanTracking = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ST Courier's 11th digit is a check digit: the first 10 digits as a number,
// mod 7. All 85 delivered 11-digit numbers in our orders pass it, and every
// number the tracking check could not find fails it, so a misread is caught
// here instead of being saved and failing the daily courier check for weeks.
// All of them start with 6 too; a new series would only ask her to confirm.
const isStNumber = (n) => /^6\d{10}$/.test(n) && Number(n.slice(0, 10)) % 7 === Number(n[10]);
export const isIndiaPostNumber = (raw) => /^[A-Z]{2}\d{9}IN$/.test(cleanTracking(raw));
export function isValidTracking(raw) {
  const n = cleanTracking(raw);
  return isStNumber(n) || isIndiaPostNumber(n);
}

// Real numbers one digit away from a misread one (one extra, one missing or
// one wrong). Slips come in runs from one book, so anything sharing the most
// leading digits with numbers we already hold goes first.
export function suggestTrackingFixes(raw, knownNumbers = [], max = 3) {
  const n = cleanTracking(raw);
  if (!/^\d{10,12}$/.test(n) || isStNumber(n)) return [];
  const out = new Set();
  if (n.length === 12) {
    for (let i = 0; i < 12; i++) out.add(n.slice(0, i) + n.slice(i + 1));
  } else {
    const keep = n.length === 11 ? 1 : 0; // replace a digit, or put a missing one in
    for (let i = 0; i <= n.length - keep; i++) {
      for (let d = 0; d <= 9; d++) out.add(n.slice(0, i) + d + n.slice(i + keep));
    }
  }
  const sharedStart = (c) => knownNumbers.reduce((best, k) => {
    let j = 0;
    while (j < c.length && c[j] === k[j]) j++;
    return Math.max(best, j);
  }, 0);
  return [...out].filter(c => c !== n && isStNumber(c))
    .map(c => ({ c, shared: sharedStart(c) }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, max)
    .map(x => x.c);
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

// What the courier's scale should read for this order — sum of each item's
// SKU shipping weight (set in SKU Management; distinct from the product's
// own content weight) × quantity, using the weekly or monthly figure
// depending on that line's pack type. Returns null if any item's SKU is
// missing a shipping weight, since a partial/guessed total would be worse
// than no signal at all for telling two orders apart.
export function expectedWeightForOrder(order, skus) {
  const items = order.items || [];
  if (items.length === 0 || !skus?.length) return null;
  let total = 0;
  for (const item of items) {
    const sku = skus.find(s => String(s.id) === String(item.sku_id || item.skuId));
    const isMonthly = (item.pack_type || item.packType) === 'monthly';
    const perUnit = isMonthly ? sku?.monthlyShippingWeightKg : sku?.shippingWeightKg;
    if (perUnit == null) return null;
    total += perUnit * (item.quantity || 1);
  }
  return total;
}

const lettersOnly = (s) => (s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

// Handwritten names rarely match in full: "Sri Dar" for Sridevi, or one name
// out of two. Compares the whole name and word by word, whichever is closer.
function nameCloseness(orderName, slipName) {
  const a = lettersOnly(orderName);
  const b = lettersOnly(slipName);
  if (!a || !b) return 0;
  const whole = similarity(a.replace(/ /g, ''), b.replace(/ /g, ''));
  const orderWords = a.split(' ').filter(w => w.length > 1);
  const slipWords = b.split(' ').filter(w => w.length > 1);
  if (!orderWords.length || !slipWords.length) return whole;
  const perWord = slipWords.map(w => Math.max(...orderWords.map(o => similarity(o, w))));
  return Math.max(whole, 0.95 * (perWord.reduce((x, y) => x + y, 0) / perWord.length));
}

const orderPincode = (order) => {
  const saved = String(order.shipping_pincode || order.pincode || '').trim();
  if (saved.length >= 5) return saved;
  return (String(order.shipping_address || '').match(/\b\d{6}\b/) || [''])[0];
};

const validDay = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) || t > Date.now() + 86400000 ? null : t;
};

// Open orders worth showing the slip reader: its choice is only a hint, and a
// short list of recent orders is what makes it useful.
export function recentOrdersForSlips(orders, limit = 40) {
  const cutoff = Date.now() - 60 * 86400000;
  return [...orders]
    .filter(o => (Date.parse(o.order_date) || 0) >= cutoff)
    .sort((a, b) => String(b.order_date || '').localeCompare(String(a.order_date || '')))
    .slice(0, limit);
}

// The counter staff write a short name, and in the Mobile box a place plus
// the end of the pincode ("Ch 116" is Chennai 600116, "Mahara 86" is 400086),
// not a phone number. Every signal adds to the name's score; the reasons are
// shown beside the order so she can see why it was suggested.
export function rankOrdersForSlip(slip, candidateOrders, skus = []) {
  if (!slip) return [];
  const text = slip.text || slip.rawText || '';
  const guessedName = slip.customerName || extractLikelyNameLine(text);
  const weight = slip.weight ?? extractWeightFromText(text);
  const phoneDigits = String(slip.phone || extractPhoneFromText(text) || '').replace(/\D/g, '').slice(-10);
  const destination = String(slip.destination || '');
  const destDigits = (destination.match(/\d+/g) || []).pop() || '';
  const destWord = (destination.toLowerCase().match(/[a-z]{2,}/) || [''])[0];
  const slipDay = validDay(slip.date || extractSlipDateFromText(text));
  const refDay = slipDay ?? Date.now();
  const lowerText = text.toLowerCase();

  const scored = candidateOrders.map(order => {
    const why = [];
    const name = order.customer_name || '';
    const nameScore = name.length >= 4 && lowerText.includes(name.toLowerCase()) ? 1 : nameCloseness(name, guessedName);
    let score = nameScore;
    if (nameScore >= 0.6) why.push('name close');

    const orderPhone = String(order.phone || '').replace(/\D/g, '').slice(-10);
    if (phoneDigits.length === 10 && orderPhone.length === 10) {
      const wrong = [...phoneDigits].filter((c, i) => c !== orderPhone[i]).length;
      if (wrong === 0) { score += 0.7; why.push('phone matches'); }
      else if (wrong === 1) { score += 0.5; why.push('phone nearly matches'); }
    }

    const pin = orderPincode(order);
    if (pin && text.includes(pin)) { score += 0.25; why.push(`pincode ${pin}`); }
    else if (pin && destDigits.length >= 2 && pin.endsWith(destDigits)) {
      score += destDigits.length >= 3 ? 0.3 : 0.15;
      why.push(`pincode ends ${destDigits}`);
    }
    if (destWord) {
      const place = `${order.shipping_city || ''} ${order.shipping_state || ''} ${order.shipping_address || ''}`.toLowerCase();
      if (new RegExp(`\\b${destWord}`).test(place)) { score += 0.1; why.push(`place ${destWord}`); }
    }

    if (weight != null) {
      const expected = expectedWeightForOrder(order, skus);
      if (expected != null) {
        const diff = Math.abs(weight - expected);
        if (diff <= 0.15) { score += 0.15; why.push('weight fits'); }
        else if (diff >= 0.5) score -= 0.15;
      }
    }

    const orderDay = Date.parse(order.order_date);
    if (!Number.isNaN(orderDay)) {
      const age = (refDay - orderDay) / 86400000;
      if (slipDay != null && age < -1) score -= 0.3; // ordered after this slip was written
      else if (age <= 10) { score += 0.1; why.push('recent order'); }
      else if (age > 30) score -= 0.2; // an old order left open, unlikely to be today's slip
    }

    if (slip.aiPickId != null && String(slip.aiPickId) === String(order.id)) { score += 0.3; why.push('reader picked it'); }

    return { order, score: Math.max(0, Math.min(1, score)), nameScore, why };
  });
  return scored.sort((a, b) => b.score - a.score
    || String(b.order.order_date || '').localeCompare(String(a.order.order_date || '')));
}

// Best guess at which order a slip belongs to. `slip` is what api/scan-slip.js
// read. Links by itself only on an exact phone number held by one open order,
// or on a close name with a clear gap over the next order; everything else
// goes to her as a suggestion. A number that fails the check never links itself.
export function findBestOrderMatch(slip, candidateOrders, skus = []) {
  const text = slip.text || slip.rawText || '';
  const readNumber = cleanTracking(slip.trackingNumber);
  const fromText = extractTrackingFromText(text);
  const trackingNumber = isValidTracking(readNumber) || !isValidTracking(fromText) ? (readNumber || fromText || null) : fromText;
  const trackingValid = isValidTracking(trackingNumber);
  const slipDate = validDay(slip.date) != null ? slip.date : extractSlipDateFromText(text);
  const weight = slip.weight ?? extractWeightFromText(text);
  const amount = slip.amount ?? extractAmountFromText(text);
  const guessedName = slip.customerName || extractLikelyNameLine(text);
  const extracted = { trackingNumber, trackingValid, slipDate, weight, amount, guessedName };

  const rawPhone = slip.phone || extractPhoneFromText(text);
  const phone = rawPhone ? String(rawPhone).replace(/\D/g, '').slice(-10) : null;
  const ranked = rankOrdersForSlip(slip, candidateOrders, skus);
  if (phone && phone.length === 10) {
    const same = ranked.filter(r => String(r.order.phone || '').replace(/\D/g, '').slice(-10) === phone);
    if (same.length) {
      return {
        order: same[0].order, confidence: 1, matchedVia: 'phone', bestCandidate: same[0].order,
        why: ['phone matches'], autoLink: same.length === 1 && trackingValid, ...extracted,
      };
    }
  }

  const best = ranked[0];
  const next = ranked[1];
  // bestCandidate is returned even below the confirm threshold, so the review
  // list can tell a bad read from an order that's genuinely not in the list.
  if (best && best.score >= 0.6) {
    const clearWinner = !next || best.score - next.score >= 0.15;
    return {
      order: best.order, confidence: best.score, matchedVia: 'name', bestCandidate: best.order, why: best.why,
      autoLink: trackingValid && best.nameScore >= 0.85 && best.score >= 0.85 && clearWinner, ...extracted,
    };
  }
  return { order: null, confidence: best?.score || 0, matchedVia: null, bestCandidate: best?.order || null, why: [], autoLink: false, ...extracted };
}

// Heuristic: the "To" name on these slips is usually a short line (1-3
// words), not a sentence — take the shortest non-numeric line as a guess.
export function extractLikelyNameLine(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const nameLines = lines.filter(l => l.length > 1 && l.length < 30 && !/\d{4,}/.test(l));
  if (nameLines.length === 0) return '';
  return nameLines.reduce((a, b) => (a.length <= b.length ? a : b));
}
