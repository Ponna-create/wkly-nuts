// Checks ST Courier's own delivery status per AWB, server-side only.
// Fully isolated from the rest of the app on purpose: this file knows
// nothing about our database or business logic — it's a pure "given an AWB,
// return ST Courier's status" utility. The caller (browser) decides which
// AWBs to check and what to do with the result; a bug or crash here can't
// touch anything else since Vercel runs every API route as its own isolated
// function, not a shared process.
//
// IMPORTANT: this is reverse-engineered, not an official API — ST Courier
// publishes no public API docs. Mechanism (verified working):
//   1. POST https://stcourier.com/track/doCheck — multipart form field
//      "awb_no", capturing the session cookie from the response.
//   2. GET https://stcourier.com/track/shipment with that same cookie — the
//      HTML response has a table: Current Status, Orgin SRC, Destination,
//      Consignment, Book Date/Time, Delivery Date/Time.
// This *will* break if ST Courier changes their site — that's the tradeoff
// of a free, unofficial route vs. a paid tracking API. Kept deliberately
// slow/small (checked in small batches, a real pause between each AWB) so
// this behaves like a person occasionally checking a few numbers, not a
// bot hammering their site.

const ALLOWED_ORIGINS = [
  'https://wkly-nuts.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsOrigin(req) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

const TRACK_URL = 'https://stcourier.com/track/doCheck';
const SHIPMENT_URL = 'https://stcourier.com/track/shipment';

function isValidAwb(awb) {
  return typeof awb === 'string' && /^\d{11}$/.test(awb.trim());
}

// Pulls the session cookie(s) needed for the follow-up GET — fetch() doesn't
// keep a cookie jar across separate requests the way curl's -c/-b does, so
// this has to be done manually.
function extractCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  // A single header value can contain multiple cookies separated by comma in
  // some runtimes, or arrive as an array in others — handle both, take just
  // the "name=value" part of each, dropping attributes (Path, HttpOnly, etc.)
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader.join(', ') : setCookieHeader;
  return raw.split(/,(?=[^;]+?=)/).map(c => c.split(';')[0].trim()).join('; ');
}

const KEY_MAP = {
  'Current Status': 'status',
  'Orgin SRC': 'origin',
  'Destination': 'destination',
  'Consignment': 'type',
  'Book Date/Time': 'bookedAt',
  'Delivery Date/Time': 'deliveredAt',
};

// The tracking page is plain HTML, not JSON — pull the two-column table rows
// with a simple regex pass rather than pulling in a full HTML parser
// dependency for one small table.
function parseTrackingTable(html) {
  if (/text-danger/i.test(html)) {
    const m = html.match(/text-danger[^>]*>([^<]+)</i);
    return { found: false, message: m ? m[1].trim() : 'Not found' };
  }
  const rowRe = /<tr[^>]*>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/gi;
  const data = {};
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const key = m[1].replace(/&nbsp;/g, ' ').trim();
    const value = m[2].replace(/&nbsp;/g, ' ').trim();
    const mapped = KEY_MAP[key];
    if (mapped) data[mapped] = value;
  }
  return Object.keys(data).length > 0 ? { found: true, ...data } : { found: false, message: 'Tracking details not found' };
}

async function checkOne(awb) {
  if (!isValidAwb(awb)) return { awb, found: false, error: 'Invalid AWB (must be 11 digits)' };

  try {
    const boundary = `----wklyNuts${Date.now()}`;
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="awb_no"\r\n\r\n${awb}\r\n--${boundary}--\r\n`;

    const postRes = await fetch(TRACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Origin': 'https://stcourier.com',
        'Referer': SHIPMENT_URL,
      },
      body,
    });

    const cookie = extractCookies(postRes.headers.get('set-cookie'));
    let checkResult;
    try {
      checkResult = await postRes.json();
    } catch {
      return { awb, found: false, error: 'Unexpected response from ST Courier (site may have changed)' };
    }

    if (checkResult.code !== 200) {
      return { awb, found: false, error: checkResult.msg || 'AWB not found' };
    }

    const pageRes = await fetch(SHIPMENT_URL, {
      headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    const html = await pageRes.text();
    const parsed = parseTrackingTable(html);
    return { awb, ...parsed };
  } catch (error) {
    return { awb, found: false, error: error.message || 'Request failed' };
  }
}

export default async function handler(req, res) {
  const origin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { awbNumbers } = req.body || {};
  if (!Array.isArray(awbNumbers) || awbNumbers.length === 0) {
    return res.status(400).json({ error: 'Missing awbNumbers (array)' });
  }
  // Hard cap regardless of what's asked for — this endpoint is meant for a
  // small daily batch, not bulk checking, by design (see file header).
  const batch = awbNumbers.slice(0, 5);

  const results = [];
  for (let i = 0; i < batch.length; i++) {
    results.push(await checkOne(batch[i]));
    if (i < batch.length - 1) {
      // A real pause between checks — not instant back-to-back requests.
      await new Promise(r => setTimeout(r, 2500 + Math.random() * 2000));
    }
  }

  return res.status(200).json({ results });
}
