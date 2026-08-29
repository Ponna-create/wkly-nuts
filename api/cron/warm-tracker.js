// Runs a few minutes before check-tracking.js (see vercel.json) purely to
// wake up the Render tracker-service, which spins down after ~15 minutes
// of no traffic on the free tier. A cold boot of that service (a full
// Docker container with Playwright/Chromium) took 33 SECONDS just to
// answer /health in testing — the real /check endpoint (browser launch +
// live page navigation) would take much longer on top of that. Left in
// the same cold state, the actual daily check would blow past Vercel's
// function time limit before Render even finished booting, and every
// order in that day's batch would fail silently.
//
// This just pings /health and waits for it, so by the time the real check
// runs, Render is already warm and the checks themselves get the full
// time budget instead of spending most of it waiting to wake up.

export default async function handler(req, res) {
  const trackerUrl = process.env.VITE_ST_COURIER_SERVICE_URL;
  if (!trackerUrl) return res.status(500).json({ error: 'Tracker service not configured' });

  const healthUrl = trackerUrl.replace(/\/check$/, '/health');
  const startedAt = Date.now();
  try {
    const r = await fetch(healthUrl, { signal: AbortSignal.timeout(55000) });
    return res.status(200).json({ ok: r.ok, ms: Date.now() - startedAt });
  } catch (error) {
    // Not fatal — the real check job still runs a few minutes later and
    // will simply eat the cold-start cost itself if this didn't land.
    return res.status(200).json({ ok: false, error: error.message, ms: Date.now() - startedAt });
  }
}
