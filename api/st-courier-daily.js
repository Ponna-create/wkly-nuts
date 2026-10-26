// Daily ST Courier check (Vercel cron, see vercel.json "crons"): every order
// that has left the shelf (fulfilled / collected / dispatched / in transit)
// with an ST consignment number gets its status refreshed from stcourier.com
// and moved forward (never backward): booked -> dispatched, on the way ->
// transit, delivered -> delivered (with the delivery date).
//
// Only orders already at fulfilled or later are touched, so their boxes have
// already left stock (sales_orders.stock_deducted_at) — this job never needs
// to move stock.
//
// The run's outcome is saved to app_settings 'stCourierDaily' so the
// Tracking screen can show when it last ran and what failed; a break in
// ST's website shows up there the same day instead of silently.
import { checkStAwb, isStAwb, stageForStatus } from './_stCourier.js';

const STAGES = ['confirmed', 'packing', 'fulfilled', 'collected', 'dispatched', 'transit', 'delivered'];
const OPEN = ['fulfilled', 'collected', 'dispatched', 'transit'];
const MAX_PER_RUN = 60;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  // When CRON_SECRET is set in Vercel, only Vercel's cron (which sends it) may run this.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Supabase URL/key not set for the server' });
  const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const rest = (path, opts = {}) => fetch(`${url}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });

  const startedAt = new Date().toISOString();
  const summary = { lastRun: startedAt, checked: 0, advanced: 0, delivered: 0, failed: 0, failures: [] };
  try {
    const q = `sales_orders?select=id,order_number,status,tracking_number,courier_name&tracking_number=not.is.null`
      + `&status=in.(${OPEN.join(',')})&order=st_courier_last_checked_at.asc.nullsfirst&limit=${MAX_PER_RUN * 2}`;
    const ordersRes = await rest(q);
    if (!ordersRes.ok) throw new Error(`Could not read orders (${ordersRes.status})`);
    const orders = (await ordersRes.json())
      .filter(o => isStAwb(o.tracking_number) && !/india\s*post|speed\s*post/i.test(o.courier_name || ''))
      .slice(0, MAX_PER_RUN);

    for (const [i, o] of orders.entries()) {
      if (i > 0) await sleep(1200); // gentle pacing: this is ST's own website
      const r = await checkStAwb(o.tracking_number);
      summary.checked++;
      const patch = { st_courier_last_checked_at: new Date().toISOString() };
      if (r.found) {
        patch.st_courier_status = r.latestEvent ? `${r.status} · ${r.latestEvent}` : r.status;
        const stage = stageForStatus(r.status);
        if (stage && STAGES.indexOf(stage) > STAGES.indexOf(o.status)) {
          patch.status = stage;
          summary.advanced++;
          if (stage === 'delivered') {
            summary.delivered++;
            const d = (r.deliveredAt || '').match(/^(\d{2})-(\d{2})-(\d{4})/);
            patch.actual_delivery_date = d ? `${d[3]}-${d[2]}-${d[1]}` : new Date().toISOString().slice(0, 10);
          }
        }
      } else {
        summary.failed++;
        summary.failures.push(`${o.order_number} (${o.tracking_number}): ${r.error}`);
        patch.st_courier_status = `Check failed: ${r.error}`;
      }
      await rest(`sales_orders?id=eq.${o.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    }
  } catch (err) {
    summary.error = err.message || 'Daily check failed';
  }
  summary.failures = summary.failures.slice(0, 20);
  summary.finishedAt = new Date().toISOString();
  await rest('app_settings', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'stCourierDaily', value: summary, updated_at: summary.finishedAt }),
  }).catch(() => {});
  return res.status(summary.error ? 500 : 200).json(summary);
}
