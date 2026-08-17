import { parseAddress } from './addressParser.js';

// Best-effort phone extraction from a pasted chat message. Tolerates spaces/
// dashes inside the number (on the same line only — newlines must NOT bridge
// two separate numbers together) and a +91/0 prefix. Indian mobiles start 6-9.
// Returns both the clean digits and the exact raw substring matched, so the
// caller can strip that substring back out of the address text.
function extractPhone(text) {
  const candidates = text.match(/(?:\+?91[ -]?)?\d[\d -]{7,13}\d/g) || [];
  for (const raw of candidates) {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10 && /^[6-9]/.test(digits)) return { phone: digits, raw };
  }
  return null;
}

const NAME_LABEL_RE = /^(?:my\s+)?(?:full\s*)?name\b\s*(?:is)?\s*(.*)$/i;
const SALUTATION_ONLY_RE = /^(to|hi|dear|hello)\s*[:,]?\s*$/i;
const ADDRESSY_RE = /\d{3}[\s-]?\d{3}|pincode|pin\s*code|street|nagar|road|colony|door\s*no|to:|address|ph\s*:|phone|mobile|cell|apartment|flat\s*no|block/i;
// House/door number lines like "No :2/11", "No 2/11", "No.12/3", "#45" —
// these are the start of the address, not a name, but they don't contain
// any of the ADDRESSY_RE keywords so they were slipping through and being
// mistaken for the customer's name when no separate "Name:" line was given.
const HOUSE_NO_RE = /^(?:no|door\s*no\.?|house\s*no\.?|h\.?no\.?|d\.?no\.?|plot\s*no\.?|#)\s*[:.]?\s*\d/i;
const PHONE_LABEL_PREFIX = '(?:ph\\.?\\s*:?\\s*no\\.?|phone(?:\\s*num(?:ber)?)?|mobile(?:\\s*no\\.?)?|cell|contact)\\s*[:\\-]?\\s*';

const stripLeadingPunct = (s) => s.replace(/^[:\-\s]+/, '').replace(/[.,]+$/, '').trim();

// Best-effort name guess: an explicit "Name:" line anywhere, else the first
// substantive line if it doesn't look like part of the address or a bare
// salutation. Meant to be edited, not trusted blind — real messages format
// this wildly inconsistently.
function extractName(lines) {
  for (const line of lines) {
    const m = line.match(NAME_LABEL_RE);
    if (m && stripLeadingPunct(m[1])) return { name: stripLeadingPunct(m[1]), matchedLine: line };
  }
  for (const line of lines) {
    if (SALUTATION_ONLY_RE.test(line)) continue;
    if (line.length < 40 && !ADDRESSY_RE.test(line) && !HOUSE_NO_RE.test(line)) {
      return { name: stripLeadingPunct(line), matchedLine: line };
    }
    break; // first substantive line looked address-y — stop, no name found
  }
  return { name: '', matchedLine: null };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Parses a raw pasted WhatsApp/Instagram order message into structured
// fields. Address/pincode/state/city extraction is solid; name is best-effort.
// The returned `address` has the detected name line and phone number
// stripped out, since those already live in their own fields — what's left
// is what actually belongs on a shipping label.
export function parseOrderPaste(text) {
  if (!text) return { name: '', phone: '', address: '', city: '', state: '', pincode: '' };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const { name, matchedLine } = extractName(lines);
  const phoneMatch = extractPhone(text);
  const phone = phoneMatch?.phone || '';

  const addr = parseAddress(text);

  // Build the cleaned address: drop the name line, then strip the phone
  // (and any label right before it, e.g. "Ph:", "Mobile no:") from what's left.
  let cleanedLines = lines.filter(l => l !== matchedLine);
  let addressText = cleanedLines.join('\n');
  if (phoneMatch) {
    const phoneRe = new RegExp(PHONE_LABEL_PREFIX + escapeRegex(phoneMatch.raw), 'i');
    addressText = phoneRe.test(addressText)
      ? addressText.replace(phoneRe, '')
      : addressText.replace(phoneMatch.raw, '');
  }
  addressText = addressText
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[,\s]+$/, '')
    .trim();

  return {
    name,
    phone,
    address: addressText,
    city: addr.city || '',
    state: addr.state || '',
    pincode: addr.pincode || '',
    oldStylePostalCode: addr.oldStylePostalCode || '',
  };
}
