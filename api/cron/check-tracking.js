// Runs automatically every morning (Vercel Cron — see vercel.json) so ST
// Courier statuses get checked and orders advanced (Dispatched -> In
// Transit -> Delivered) whether or not anyone opens the app that day.
// Does exactly what the manual "Check Today's Batch" button in Delivery
// Tracking & Feedback does (TrackingChecker.jsx / checkOneStCourierAwb in
// src/services/supabase.js) — same candidate selection, same stage-mapping
// — just fired by Vercel's scheduler instead of a click. Kept as its own
// small Node function (not importing the Vite-side dbService, which relies
// on import.meta.env) rather than sharing code, since this runs in a
// different module system.
//
// api/cron/warm-tracker.js runs a few minutes before this to wake up the
// Render tracker-service (free tier spins down when idle — a cold boot
// took 33s just for /health in testing, before any real check work even
// starts). Batch size here is kept smaller than the manual button's (3 vs
// 5) to comfortably fit inside Vercel's function time limit even if the
// warm-up didn't land — each real check is a live browser navigation, not
// a cheap API call.

import { createClient } from '@supabase/supabase-js';

const MAX_PER_RUN = 3;
const DELAY_MS = 2500; // gap between orders, same spirit as the manual button's pacing
const FETCH_TIMEOUT_MS = 45000; // fail one order cleanly rather than risk the whole function running out of time

// Same pipeline-stage list and mapping as checkOneStCourierAwb() in
// src/services/supabase.js — keep both in sync if ST Courier's wording changes.
const STAGE_ORDER = ['confirmed', 'packing', 'fulfilled', 'collected', 'dispatched', 'transit', 'delivered'];
function mapStatusToStage(rawStatus) {
  const s = (rawStatus || '').toLowerCase();
  if (/delivered/.test(s)) return 'delivered';
  if (/out for delivery|in transit|on the way|reached destination/.test(s)) return 'transit';
  if (/dispatch|picked up|booked|in transit hub|departed/.test(s)) return 'dispatched';
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayISO = () => new Date().toISOString().split('T')[0];

export default async function handler(req, res) {
  // Vercel Cron sends this header on scheduled invocations; if CRON_SECRET
  // is set, require it so this endpoint can't be triggered by anyone who
  // finds the URL.
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const trackerUrl = process.env.VITE_ST_COURIER_SERVICE_URL;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });
  if (!trackerUrl) return res.status(500).json({ error: 'Tracker service not configured' });

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: candidates, error: fetchError } = await supabase
      .from('sales_orders')
      .select('id, status, tracking_number, st_courier_last_checked_at')
      .in('status', ['collected', 'dispatched', 'transit'])
      .not('tracking_number', 'is', null)
      .order('st_courier_last_checked_at', { ascending: true, nullsFirst: true })
      .limit(MAX_PER_RUN);
    if (fetchError) throw fetchError;

    if (!candidates || candidates.length === 0) {
      return res.status(200).json({ checked: 0, message: 'No trackable orders' });
    }

    const results = [];
    let successCount = 0;
    for (let i = 0; i < candidates.length; i++) {
      const order = candidates[i];
      const awb = (order.tracking_number || '').replace(/\D/g, '');
      let outcome = { id: order.id, awb };

      if (!awb) {
        outcome.error = 'No valid AWB';
      } else {
        try {
          const checkRes = await fetch(trackerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ awbNumbers: [awb] }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!checkRes.ok) throw new Error(`Tracker service HTTP ${checkRes.status}`);
          const { results: trackerResults } = await checkRes.json();
          const r = (trackerResults || [])[0];
          if (!r) throw new Error('No result returned from tracker service');

          const update = { st_courier_last_checked_at: new Date().toISOString() };
          if (r.found && r.status) {
            update.st_courier_status = r.status;
            const mappedStage = mapStatusToStage(r.status);
            if (mappedStage) {
              const currentIdx = STAGE_ORDER.indexOf(order.status);
              const mappedIdx = STAGE_ORDER.indexOf(mappedStage);
              if (mappedIdx > currentIdx) {
                update.status = mappedStage;
                outcome.advancedTo = mappedStage;
                if (mappedStage === 'delivered') update.actual_delivery_date = todayISO();
              }
            }
          } else {
            update.st_courier_status = r.error || 'Not found';
          }

          const { error: updateError } = await supabase.from('sales_orders').update(update).eq('id', order.id);
          if (updateError) throw updateError;
          outcome.status = update.st_courier_status;
          successCount++; // reached the tracker and wrote a result — counts as a real check, even if ST Courier itself said "Not found"
        } catch (err) {
          outcome.error = err.name === 'TimeoutError' ? 'Tracker service timed out (likely still waking up)' : (err.message || 'Check failed');
        }
      }

      results.push(outcome);
      if (i < candidates.length - 1) await sleep(DELAY_MS);
    }

    // Only mark today as "checked" if at least one order actually got a
    // real result. Previously this was written unconditionally, so a
    // morning where the tracker service was still cold-booting and every
    // check failed still locked the manual "Check Today's Batch" button
    // for the rest of the day, with nothing to show for it and no way to
    // retry until tomorrow.
    if (successCount > 0) {
      await supabase.from('app_settings').upsert({
        key: 'st_courier_auto_check',
        value: { date: todayISO(), at: new Date().toISOString(), source: 'cron', checkedCount: successCount },
        updated_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({ checked: results.length, succeeded: successCount, results });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Cron run failed' });
  }
}
