// Standalone ST Courier status checker — real headless Chrome (Playwright),
// deployed on Render, not Vercel. ST Courier's tracking page runs a jQuery
// AJAX check, then does `location.reload()`, and the result renders
// server-side based on session state — that flow only works correctly
// inside an actual browser actually running their JavaScript. A plain HTTP
// fetch (which is all Vercel's lightweight serverless functions can do
// without a much heavier setup) can't replicate it; this can, because it's
// driving a real Chrome instance exactly the way a person would.
//
// Deliberately kept stateless — no database credentials here at all. This
// service knows nothing about WKLY Nuts' orders or database; it only knows
// "given an AWB, return ST Courier's status." The main app (Vercel) decides
// which orders to check and writes results back to Supabase, calling this
// service the same way it called the old /api/st-courier-status.js Vercel
// function — same request/response shape, so swapping the URL was the only
// change needed on that side.
//
// Adapted from a working local Playwright script (verified against real
// tracking numbers) — same DOM-reading logic, wrapped in an HTTP endpoint
// and pointed at the Docker image's bundled Chromium instead of a local
// Chrome install path.

const express = require('express');
const { chromium } = require('playwright-core');

const app = express();
app.use(express.json());

const ALLOWED_ORIGINS = [
  'https://wkly-nuts.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const DELAY_MS = 7000; // same pacing as the validated local script — a real pause, not back-to-back requests
const MAX_PER_REQUEST = 5; // small daily batch by design, not bulk checking

function isValidAwb(awb) {
  return typeof awb === 'string' && /^\d{10,13}$/.test(awb.trim());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readTableData(page) {
  return page.evaluate(() => {
    const result = {};
    for (const row of Array.from(document.querySelectorAll('tr'))) {
      const cells = Array.from(row.querySelectorAll('td, th'))
        .map((cell) => cell.innerText.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (cells.length >= 2) result[cells[0]] = cells.slice(1).join(' | ');
    }
    return result;
  });
}

async function readLatestEvent(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.replace(/\r/g, '');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const statusIdx = lines.findIndex((l) => /^Status of AWB No\./i.test(l));
    if (statusIdx === -1) return '';
    const after = lines.slice(statusIdx + 1);
    return after.find((l) =>
      !/^\d{1,2}:\d{2}/.test(l) &&
      !/^\w{3}\s+\d{1,2},\s+\d{4}$/i.test(l) &&
      !/^[A-Z0-9 -]+,\s*[A-Z]{2}$/i.test(l)
    ) || '';
  });
}

async function checkOne(page, awb) {
  if (!isValidAwb(awb)) return { awb, found: false, error: 'Invalid AWB (must be 10-13 digits)' };

  try {
    await page.goto('https://stcourier.com/track/shipment', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#awb_no', awb);
    await Promise.all([
      page.waitForLoadState('domcontentloaded', { timeout: 45000 }).catch(() => {}),
      page.click('#track'),
    ]);
    await page.waitForTimeout(5000);

    const tableData = await readTableData(page);
    const bodyText = await page.locator('body').innerText({ timeout: 10000 });
    const latestEvent = await readLatestEvent(page);
    const status = tableData['Current Status'] || (/\bDelivered\b/i.test(bodyText) ? 'Delivered' : '');

    if (!status) return { awb, found: false, error: 'Could not read status from page' };

    return {
      awb,
      found: true,
      status,
      origin: tableData['Orgin SRC'] || tableData['Origin SRC'] || '',
      destination: tableData.Destination || '',
      type: tableData.Consignment || '',
      bookedAt: tableData['Book Date/Time'] || '',
      deliveredAt: tableData['Delivery Date/Time'] || '',
      latestEvent,
    };
  } catch (error) {
    return { awb, found: false, error: error.message || 'Request failed' };
  }
}

app.post('/check', async (req, res) => {
  const { awbNumbers } = req.body || {};
  if (!Array.isArray(awbNumbers) || awbNumbers.length === 0) {
    return res.status(400).json({ error: 'Missing awbNumbers (array)' });
  }
  const batch = awbNumbers.slice(0, MAX_PER_REQUEST);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const results = [];
    for (let i = 0; i < batch.length; i++) {
      results.push(await checkOne(page, batch[i]));
      if (i < batch.length - 1) await sleep(DELAY_MS);
    }
    return res.status(200).json({ results });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Browser launch failed' });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

app.get('/health', (req, res) => res.status(200).json({ ok: true }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`ST Courier tracker service listening on :${PORT}`));
