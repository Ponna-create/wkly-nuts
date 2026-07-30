import { parseAddress } from './addressParser.js';

// Best-effort phone extraction from a pasted chat message. Tolerates spaces/
// dashes inside the number (on the same line only — newlines must NOT bridge
// two separate numbers together) and a +91/0 prefix. Indian mobiles start 6-9.
function extractPhone(text) {
  const candidates = text.match(/(?:\+?91[ -]?)?\d[\d -]{7,13}\d/g) || [];
  for (const c of candidates) {
    let digits = c.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  }
  return null;
}

const NAME_LABEL_RE = /^(?:my\s+)?(?:full\s*)?name\b\s*(?:is)?\s*(.*)$/i;
const SALUTATION_ONLY_RE = /^(to|hi|dear|hello)\s*[:,]?\s*$/i;
const ADDRESSY_RE = /\d{3}[\s-]?\d{3}|pincode|pin\s*code|street|nagar|road|colony|door\s*no|to:|address|ph\s*:|phone|mobile|cell|apartment|flat\s*no|block/i;

const stripLeadingPunct = (s) => s.replace(/^[:\-\s]+/, '').replace(/[.,]+$/, '').trim();

// Best-effort name guess: an explicit "Name:" line anywhere, else the first
// substantive line if it doesn't look like part of the address or a bare
// salutation. Meant to be edited, not trusted blind — real messages format
// this wildly inconsistently.
function extractName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(NAME_LABEL_RE);
    if (m && stripLeadingPunct(m[1])) return stripLeadingPunct(m[1]);
  }
  for (const line of lines) {
    if (SALUTATION_ONLY_RE.test(line)) continue;
    if (line.length < 40 && !ADDRESSY_RE.test(line)) return stripLeadingPunct(line);
    break; // first substantive line looked address-y — stop, no name found
  }
  return '';
}

// Parses a raw pasted WhatsApp/Instagram order message into structured
// fields. Address/pincode/state/city extraction is solid; name is best-effort.
export function parseOrderPaste(text) {
  if (!text) return { name: '', phone: '', address: text || '', city: '', state: '', pincode: '' };
  const address = parseAddress(text);
  return {
    name: extractName(text),
    phone: extractPhone(text) || '',
    address: text,
    city: address.city || '',
    state: address.state || '',
    pincode: address.pincode || '',
  };
}
