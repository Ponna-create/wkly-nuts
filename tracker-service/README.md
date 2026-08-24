# ST Courier Tracker Service

A tiny, standalone service that checks ST Courier's real delivery status using an actual headless Chrome browser (Playwright) — deployed separately from the main WKLY Nuts app so it can never affect the app's build or runtime. Runs on Render, not Vercel, because Vercel's serverless functions can't run a full browser.

It's stateless — no database access, no knowledge of orders. One endpoint: give it AWB numbers, it returns their status.

## Why this exists

ST Courier's tracking page doesn't return a result from a plain HTTP request. It runs a jQuery AJAX check, then does `location.reload()`, and the actual result renders server-side based on session state — that flow only works inside a real browser running their JavaScript. This service drives an actual Chrome instance to do exactly that, the same way a person checking manually would.

## Deploying to Render (one-time setup)

1. Go to [render.com](https://render.com) and sign up (free) if you haven't.
2. **New +** → **Web Service**.
3. Connect the `wkly-nuts` GitHub repo.
4. Settings:
   - **Root Directory**: `tracker-service`
   - **Environment**: Docker (Render should auto-detect the Dockerfile once Root Directory is set)
   - **Instance Type**: Free
5. Click **Create Web Service**. First deploy takes a few minutes (building the Playwright/Chrome image).
6. Once it's live, Render gives you a URL like `https://wkly-nuts-tracker.onrender.com` — copy that.

No environment variables needed — this service doesn't touch the database.

**Free tier note**: it spins down after ~15 minutes of no traffic and takes 30-60 seconds to wake up on the next request. Fine for a once-a-day check where you're already watching a progress bar in the app — not fine if you needed instant results, which this doesn't.

## Wiring it into the app

Once deployed, set `VITE_ST_COURIER_SERVICE_URL` in the main app's Vercel project environment variables to the Render URL (e.g. `https://wkly-nuts-tracker.onrender.com/check`), then redeploy the main app. See `src/services/supabase.js` — `checkOneStCourierAwb()`.

## API

```
POST /check
{ "awbNumbers": ["643629117771"] }   // up to 5 per request

→ { "results": [
      { "awb": "643629117771", "found": true, "status": "Delivered", "origin": "...", "destination": "...", "type": "...", "bookedAt": "...", "deliveredAt": "...", "latestEvent": "..." }
      // or, on failure: { "awb": "...", "found": false, "error": "..." }
    ] }
```

## Local testing

```bash
cd tracker-service
npm install
node server.js
# then, from another terminal:
curl -X POST http://localhost:10000/check -H "Content-Type: application/json" -d "{\"awbNumbers\":[\"643629117771\"]}"
```

(Local testing needs Playwright's Chromium installed — `npx playwright install chromium` — since this repo uses `playwright-core`, which relies on the Docker image's bundled browser in production but needs one installed manually for local runs.)
