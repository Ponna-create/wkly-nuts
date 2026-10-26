// ST Courier status for one consignment (AWB), with plain HTTP — no browser.
//
// Their tracking page works in two steps that share a session cookie:
//   1. POST the AWB to /track/doCheck (stores it in the session), then
//   2. GET /track/shipment, which renders the result for that session.
// The earlier attempt at this skipped the cookie, so step 2 came back empty
// and a headless-Chrome service (tracker-service/, Playwright on Render) was
// used instead. Carrying the cookie makes the plain request work, verified
// 2026-10-26 against a real delivered AWB.
//
// Unofficial: this is what stcourier.com's own page does, not a published
// API. If they change it, lookups return { found: false, error } and the
// daily check records the failure where the app shows it.
//
// Files starting with "_" in /api are not routes on Vercel; this is shared by
// st-courier-status.js (one-off checks from the app) and st-courier-daily.js (cron).

const BASE = 'https://stcourier.com/track';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export const isStAwb = (awb) => /^\d{10,13}$/.test(String(awb || '').trim());

const text = (html) => html.replace(/<br\s*\/?>/gi, ' | ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export async function checkStAwb(awbRaw) {
  const awb = String(awbRaw || '').replace(/\D/g, '');
  if (!isStAwb(awb)) return { awb, found: false, error: 'Not an ST Courier number' };
  const jar = new Map();
  const keep = (res) => (res.headers.getSetCookie ? res.headers.getSetCookie() : []).forEach(c => {
    const kv = c.split(';')[0]; const i = kv.indexOf('='); if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1));
  });
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  try {
    keep(await fetch(`${BASE}/shipment`, { headers: { 'User-Agent': UA } }));
    const form = new FormData();
    form.append('awb_no', awb);
    const check = await fetch(`${BASE}/doCheck`, {
      method: 'POST', body: form,
      headers: { 'User-Agent': UA, Cookie: cookie(), 'X-Requested-With': 'XMLHttpRequest', Referer: `${BASE}/shipment` },
    });
    keep(check);
    if (!check.ok) return { awb, found: false, error: `ST Courier answered ${check.status}` };
    const page = await fetch(`${BASE}/shipment`, { headers: { 'User-Agent': UA, Cookie: cookie(), Referer: `${BASE}/shipment` } });
    if (!page.ok) return { awb, found: false, error: `ST Courier answered ${page.status}` };
    const html = await page.text();

    // "Delivery Status" table: two cells per row, label | value
    const table = {};
    for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []) {
      const cells = (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(text).filter(Boolean);
      if (cells.length === 2) table[cells[0].replace(/\s*:$/, '')] = cells[1];
    }
    const status = table['Current Status'] || '';
    if (!status) return { awb, found: false, error: 'No status shown for this number (wrong number, or ST changed their page)' };

    // Timeline under "Status of AWB No.": date | time, then status | place
    const events = [];
    const tl = html.split(/Status of AWB No\./i)[1] || '';
    const flat = text(tl);
    const re = /([A-Z][a-z]{2} \d{1,2}, \d{4}) \| (\d{1,2}:\d{2} [AP]M) (.+?) \| (.+?) \|/g;
    let m;
    while ((m = re.exec(flat)) && events.length < 20) events.push({ date: m[1], time: m[2], status: m[3].trim(), place: m[4].trim() });

    return {
      awb,
      found: true,
      status,
      origin: table['Orgin SRC'] || table['Origin SRC'] || '',
      destination: table.Destination || '',
      type: table.Consignment || '',
      bookedAt: table['Book Date/Time'] || '',
      deliveredAt: table['Delivery Date/Time'] || '',
      latestEvent: events[0] ? `${events[0].status}, ${events[0].place} (${events[0].date} ${events[0].time})` : '',
      events,
    };
  } catch (error) {
    return { awb, found: false, error: `Could not reach ST Courier: ${error.message || 'request failed'}` };
  }
}

// Our pipeline stage for ST's free-text status (same rules as the app's).
export function stageForStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (/delivered/.test(s)) return 'delivered';
  if (/out for delivery|in transit|on the way|reached destination|processed|forwarded/.test(s)) return 'transit';
  if (/dispatch|picked up|booked|departed/.test(s)) return 'dispatched';
  return null;
}
