// Reads a courier slip photo with a multimodal LLM, server-side only — the
// API keys must never reach the browser. Switched from Google Cloud
// Vision's plain TEXT_DETECTION because that's character-recognition OCR
// with no idea what it's looking at: it garbled messy handwritten names into
// nonsense (random Cyrillic/CJK characters) since it was just guessing at
// scripts. A real multimodal model reads the slip the way a person would —
// it knows the squiggle in the "To:" box is a name.
//
// Rebuilt after real slips kept failing here despite reading fine in
// Gemini's own consumer chat with the identical photo. The two aren't
// actually equivalent even though they hit the same underlying model:
//   1. This forced a rigid typed JSON schema on the FIRST response — no room
//      to reason about a hard read before committing to an answer. Chat has
//      no such constraint. Structured decoding under a strict schema is a
//      known accuracy hit on tasks that need real visual reasoning, not just
//      lookup. Switched to free-form text + a delimiter the model fills in,
//      parsed on our side — same result shape, without forcing the answer
//      before it's "thought" about the image.
//   2. Every upstream failure was swallowed into a server log she can never
//      see and reported to the client as one generic "request failed" with
//      no detail — pure guesswork trying to diagnose from outside. Now
//      returns a real (truncated) snippet of what the provider actually said.
//
// Provider fallback chain (added after discovering the free Gemini tier is
// capped at just 20 requests/day per model — a busy day of courier slips
// blows through that easily, and it stays broken for the rest of the day):
//   1. Gemini (gemini-flash-latest, then a second pinned Gemini model) —
//      tried first since this is the combination already validated against
//      real messy handwriting.
//   2. Groq's qwen/qwen3.6-27b — a completely separate provider with its
//      own free quota (1,000 requests/day, 50x Gemini's), only used once
//      every Gemini option is exhausted for the day. Untested against hard
//      handwriting compared to Gemini, so it's the fallback, not the
//      primary — everything it returns still goes through the same human
//      review step as a Gemini read, so a worse guess here just means one
//      more manual pick, not bad data going in silently.
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

// Same parsing for whichever provider actually answered — both are asked
// for identical plain-text output, so this is provider-agnostic.
function parseFields(text) {
  const field = (label) => {
    const m = text.match(new RegExp(`${label}:\\s*(.*)`, 'i'));
    if (!m) return null;
    const val = m[1].trim();
    return (!val || /^null$/i.test(val)) ? null : val;
  };
  const weightRaw = field('WEIGHT');
  const amountRaw = field('AMOUNT');
  return {
    trackingNumber: field('TRACKING'),
    customerName: field('NAME'),
    phone: field('PHONE'),
    weight: weightRaw ? parseFloat(weightRaw.replace(/[^\d.]/g, '')) || null : null,
    amount: amountRaw ? parseFloat(amountRaw.replace(/[^\d.]/g, '')) || null : null,
    date: field('DATE'),
    rawText: field('RAWTEXT') || '',
  };
}

// Free-tier "flash" models are a shared capacity pool across every Gemini
// user worldwide — at peak-demand hours the primary alias can return a
// sustained 503 "model overloaded" for a long stretch, not just a one-off
// blip that a few seconds of retrying clears. Falling back to a second,
// specifically-pinned Gemini model (a separate capacity pool from the
// "-latest" alias) gives a real second chance instead of hitting the same
// congested pool three times in a row. Only used for a genuine "overloaded"
// (503) — other error codes (400 bad request, 429 rate limit) mean trying
// a different model wouldn't help, so those still fail through immediately.
//
// gemini-2.5-flash was pinned here originally but Google retired it for
// new-user access shortly after (its own error response names the
// replacement) — pointing this at a second "-latest"-style alias instead
// of another hardcoded version number, so a future retirement doesn't
// silently break this fallback again.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash'];

async function tryGemini(apiKey, base64, mimeType) {
  let geminiRes, errText, usedModel;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    usedModel = GEMINI_MODELS[i];
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
          // No responseSchema, deliberately — see file header. Plain text
          // out, parsed by parseFields().
        }),
      }
    );
    if (geminiRes.ok) break;
    errText = await geminiRes.text();
    console.error('Gemini API error:', usedModel, geminiRes.status, errText);
    const isOverloaded = geminiRes.status === 503;
    if (isOverloaded && i < GEMINI_MODELS.length - 1) continue; // try the next Gemini model
    break; // not an overload, or no more Gemini models left to try
  }

  if (!geminiRes.ok) {
    return { ok: false, status: geminiRes.status, detail: errText.slice(0, 300), model: usedModel };
  }
  const data = await geminiRes.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { ok: true, text, finishReason, model: usedModel };
}

const GROQ_MODEL = 'qwen/qwen3.6-27b';

async function tryGroq(apiKey, base64, mimeType) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('Groq API error:', GROQ_MODEL, res.status, errText);
    return { ok: false, status: res.status, detail: errText.slice(0, 300), model: GROQ_MODEL };
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return { ok: true, text, finishReason: data?.choices?.[0]?.finish_reason, model: GROQ_MODEL };
}

export default async function handler(req, res) {
  const origin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey && !groqKey) {
    return res.status(500).json({ error: 'Slip reading not configured — no API key set' });
  }

  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing image (base64)' });
  }
  const commaIdx = image.indexOf(',');
  const base64 = commaIdx !== -1 ? image.slice(commaIdx + 1) : image;
  const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  try {
    // Groq first: its free tier has 50x Gemini's daily cap (1,000 vs 20
    // requests/day) and, unlike Gemini's free tier, doesn't use submitted
    // data for training/human review by default. Gemini is the fallback —
    // still useful for the rare photo Groq's model can't make out, since a
    // second independent read is better than none.
    let result = groqKey
      ? await tryGroq(groqKey, base64, mimeType)
      : { ok: false, status: null, detail: 'GROQ_API_KEY not set' };

    if (!result.ok && geminiKey) {
      const geminiResult = await tryGemini(geminiKey, base64, mimeType);
      if (geminiResult.ok) {
        result = geminiResult;
      } else {
        // Surface both providers' failures so it's clear neither is a
        // one-off — this is what "genuinely out of free capacity everywhere"
        // looks like, not a single black-box error.
        return res.status(502).json({
          error: 'Slip reading request failed on every provider',
          groqStatus: result.status,
          groqDetail: result.detail,
          geminiStatus: geminiResult.status,
          geminiDetail: geminiResult.detail,
        });
      }
    }

    if (!result.ok) {
      return res.status(502).json({ error: 'Slip reading request failed', groqStatus: result.status, groqDetail: result.detail, model: result.model });
    }

    if (!result.text) {
      // The model responded but produced no usable content — most commonly
      // a safety filter or hitting its own output token limit, not "the
      // photo was unreadable". Worth telling apart from a genuine empty read.
      return res.status(200).json({
        trackingNumber: null, customerName: null, phone: null, weight: null,
        amount: null, date: null, rawText: '',
        emptyReason: result.finishReason || 'no content returned',
      });
    }

    return res.status(200).json({ ...parseFields(result.text), provider: result.model });
  } catch (error) {
    console.error('scan-slip error:', error);
    return res.status(500).json({ error: 'Internal server error', detail: String(error?.message || error).slice(0, 300) });
  }
}
