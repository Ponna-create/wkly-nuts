// Reads a courier slip photo with Gemini (multimodal LLM), server-side only
// — the API key must never reach the browser. Switched from Google Cloud
// Vision's plain TEXT_DETECTION because that's character-recognition OCR
// with no idea what it's looking at: it garbled messy handwritten names into
// nonsense (random Cyrillic/CJK characters) since it was just guessing at
// scripts. Gemini actually reads the slip the way a person would — it knows
// the squiggle in the "To:" box is a name.
//
// Rebuilt after real slips kept failing here despite reading fine in
// Gemini's own consumer chat with the identical photo. The two aren't
// actually equivalent even though they hit the same underlying model:
//   1. This forced a rigid typed JSON schema on the FIRST response — no room
//      to reason about a hard read before committing to an answer. Chat has
//      no such constraint. Structured decoding under a strict schema is a
//      known accuracy hit on tasks that need real visual reasoning, not just
//      lookup. Switched to free-form text + a delimiter Gemini fills in,
//      parsed on our side — same result shape, without forcing the answer
//      before it's "thought" about the image.
//   2. Every upstream failure was swallowed into a server log she can never
//      see and reported to the client as one generic "request failed" with
//      no detail — pure guesswork trying to diagnose from outside. Now
//      returns a real (truncated) snippet of what Gemini's API actually said.
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

const PROMPT = `You are reading a courier consignment slip (ST Courier, India) from a photo, exactly the way you'd read it if someone pasted this photo directly into a chat with you. Some fields are handwritten and messy — read them carefully and use context (this is a shipping slip) to work out what they say, the way a person would, rather than transcribing stray marks literally.

Look at the whole photo first, then report these fields, one per line, in exactly this format (use "null" with no quotes for anything truly illegible or blank — but judge each field independently, a messy name does NOT mean the tracking number is also unreadable):

TRACKING: the printed CONSIGNMENT NUMBER, 11-12 digits, printed under the barcode (machine-printed, not handwritten — should almost always be readable even when the rest of the slip is messy)
NAME: the handwritten name in the "To:" / "Receiver's Full Name" box — give your best reading even if not fully certain of every letter, a human confirms this afterward
PHONE: the handwritten mobile number in the "To: Mobile:" box, digits only
WEIGHT: the weight in KG as a plain number
AMOUNT: the number written in the Cash or Credit box (the shipping amount collected)
DATE: the DATE field as YYYY-MM-DD (assume 2026 if no year shown)
RAWTEXT: every other word/number you can make out on the slip, space-separated, for fallback matching

A low-confidence best guess is far more useful to us than "null" — someone reviews and confirms every result afterward, so don't hold back a reasonable reading just because you're not 100% sure. Only write null when there's truly nothing to go on for that field. Respond with ONLY those 7 lines, nothing else before or after.`;

export default async function handler(req, res) {
  const origin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Slip reading not configured — GEMINI_API_KEY missing' });

  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing image (base64)' });
  }
  const commaIdx = image.indexOf(',');
  const base64 = commaIdx !== -1 ? image.slice(commaIdx + 1) : image;
  const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  // Free-tier "flash" models are a shared capacity pool across every Gemini
  // user worldwide — at peak-demand hours the primary alias can return a
  // sustained 503 "model overloaded" for a long stretch, not just a one-off
  // blip that a few seconds of retrying clears. Falling back to a second,
  // specifically-pinned model (a separate capacity pool from the "-latest"
  // alias) gives a real second chance instead of hitting the same congested
  // pool three times in a row. Only used for a genuine "overloaded" (503) —
  // other error codes (400 bad request, 429 rate limit) mean trying a
  // different model wouldn't help, so those still fail through immediately.
  const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];

  try {
    let geminiRes, errText, usedModel;
    for (let i = 0; i < MODELS.length; i++) {
      usedModel = MODELS[i];
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${usedModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            }],
            // No responseSchema this time, deliberately — see file header.
            // Plain text out, parsed below.
          }),
        }
      );
      if (geminiRes.ok) break;
      errText = await geminiRes.text();
      console.error('Gemini API error:', usedModel, geminiRes.status, errText);
      const isOverloaded = geminiRes.status === 503;
      if (isOverloaded && i < MODELS.length - 1) continue; // try the next model
      break; // not an overload, or no more models left to try
    }

    if (!geminiRes.ok) {
      // Actually surface what Gemini said instead of a black-box "failed" —
      // this is the detail that was previously only in a log nobody could see.
      return res.status(502).json({ error: 'Slip reading request failed', geminiStatus: geminiRes.status, geminiDetail: errText.slice(0, 300), model: usedModel });
    }

    const data = await geminiRes.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      // The model responded but produced no usable content — most commonly
      // a safety filter or hitting its own output token limit, not "the
      // photo was unreadable". Worth telling apart from a genuine empty read.
      return res.status(200).json({
        trackingNumber: null, customerName: null, phone: null, weight: null,
        amount: null, date: null, rawText: '',
        emptyReason: finishReason || 'no content returned',
      });
    }

    const field = (label) => {
      const m = text.match(new RegExp(`${label}:\\s*(.*)`, 'i'));
      if (!m) return null;
      const val = m[1].trim();
      return (!val || /^null$/i.test(val)) ? null : val;
    };

    const weightRaw = field('WEIGHT');
    const amountRaw = field('AMOUNT');

    return res.status(200).json({
      trackingNumber: field('TRACKING'),
      customerName: field('NAME'),
      phone: field('PHONE'),
      weight: weightRaw ? parseFloat(weightRaw.replace(/[^\d.]/g, '')) || null : null,
      amount: amountRaw ? parseFloat(amountRaw.replace(/[^\d.]/g, '')) || null : null,
      date: field('DATE'),
      rawText: field('RAWTEXT') || '',
    });
  } catch (error) {
    console.error('scan-slip error:', error);
    return res.status(500).json({ error: 'Internal server error', detail: String(error?.message || error).slice(0, 300) });
  }
}
