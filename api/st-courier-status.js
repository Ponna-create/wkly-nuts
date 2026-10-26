// One-off ST Courier status checks from the app (Tracking "Check now").
// POST { awbNumbers: ['64401939265', ...] } -> { results: [...] }, at most 5
// per call — the same request/response shape the old Playwright
// tracker-service had, so the app only changed the URL it calls.
import { checkStAwb } from './_stCourier.js';

const ALLOWED_ORIGINS = ['https://wkly-nuts.vercel.app', 'http://localhost:5173', 'http://localhost:3000'];
const MAX_PER_REQUEST = 5;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { awbNumbers } = req.body || {};
  if (!Array.isArray(awbNumbers) || awbNumbers.length === 0) return res.status(400).json({ error: 'Missing awbNumbers (array)' });

  const results = [];
  for (const [i, awb] of awbNumbers.slice(0, MAX_PER_REQUEST).entries()) {
    if (i > 0) await sleep(1200); // gentle pacing: this is ST's own website
    results.push(await checkStAwb(awb));
  }
  return res.status(200).json({ results });
}
