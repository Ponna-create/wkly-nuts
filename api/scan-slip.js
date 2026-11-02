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

// `candidates` are recent open orders (name and place only). Choosing from a
// short list is far more reliable than reading messy handwriting cold; the
// app treats the choice as a hint and she confirms it.
function buildPrompt(candidates) {
  const year = new Date().getFullYear();
  const list = Array.isArray(candidates) && candidates.length
    ? `\n\nThese are the orders waiting to be shipped. Decide which one this slip most likely belongs to:\n${candidates.slice(0, 40).map((c, i) => `${i + 1}. ${String(c.name || '').slice(0, 40)}${c.place ? ` (${String(c.place).slice(0, 30)})` : ''}`).join('\n')}`
    : '';
  return `You are reading a courier slip from a photo. The photo is often sideways or upside down, so work out which way up it is before reading. It is usually an ST Courier consignment slip with handwriting by counter staff, or a printed India Post receipt. Read handwriting using context, the way a person would, rather than transcribing stray marks. A messy name does NOT mean the other fields are unreadable: judge each field on its own.

On ST Courier slips:
- The consignment number is printed under the barcode: exactly 11 digits. Copy each printed digit one at a time, and never add or drop one.
- "From" is always the sender, Wkly. Never report that as the name. The customer is the handwriting beside "To".
- The "Mobile" box under "To" usually does NOT hold a phone number. It usually has a short place name and the last digits of the pincode, for example "Ch 116" for Chennai 600116 or "Mahara 86" for Maharashtra 400086.
- KG and Cash are handwritten numbers, for example 1.40 and 60.

Report these fields, one per line, in exactly this format (write null with no quotes for anything truly blank or illegible):

TRACKING: the consignment number. On an India Post receipt this looks like CX078669098IN
NAME: the customer's name, your best reading even if unsure of some letters
PHONE: the customer's mobile number, only if a full 10-digit number is really there, digits only
DESTINATION: what is written in the "To" Mobile box, or the customer's city and pincode on a printed receipt, exactly as written
WEIGHT: the weight in KG as a plain number
AMOUNT: the number in the Cash or Credit box (on India Post, the amount paid)
DATE: the slip's date as YYYY-MM-DD (assume ${year} if no year is shown)
MATCH: the list number of the order this slip most likely belongs to, or null if none fits or no list is given
RAWTEXT: every other word or number you can make out, space-separated

A low-confidence best guess is far more useful than null, because someone confirms every result afterward. Respond with ONLY those 9 lines.${list}`;
}

// Same parsing for whichever provider actually answered — both are asked
// for identical plain-text output, so this is provider-agnostic.
function parseFields(text) {
  const field = (label) => {
    const m = text.match(new RegExp(`${label}:\\s*(.*)`, 'i'));
    if (!m) return null;
    const val = m[1].replace(/\*/g, '').trim();
    return (!val || /^null$/i.test(val)) ? null : val;
  };
  const weightRaw = field('WEIGHT');
  const amountRaw = field('AMOUNT');
  return {
    trackingNumber: field('TRACKING'),
    customerName: field('NAME'),
    phone: field('PHONE'),
    destination: field('DESTINATION'),
    matchIndex: parseInt(field('MATCH'), 10) || null,
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

async function tryGemini(apiKey, base64, mimeType, prompt) {
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
              { text: prompt },
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

// Groq retires/renames models often ("model not found" is what broke slip
// scanning), so try several vision-capable models in order instead of
// depending on one name. Only "model missing/decommissioned" style errors
// move on to the next model — a rate limit or bad request would fail the
// same way on every model.
const GROQ_MODELS = [
  'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
];

async function tryGroqModel(apiKey, base64, mimeType, model, prompt) {
  const body = {
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    }],
  };
  // The qwen models default to "thinking mode", which mixes internal
  // reasoning into the answer (produced garbled output like "Tracking: **").
  // Turning it off gets the clean 7-line answer. Llama doesn't take this option.
  if (model.startsWith('qwen/')) body.reasoning_effort = 'none';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('Groq API error:', model, res.status, errText);
    return { ok: false, status: res.status, detail: errText.slice(0, 300), model };
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return { ok: true, text, finishReason: data?.choices?.[0]?.finish_reason, model };
}

async function tryGroq(apiKey, base64, mimeType, prompt) {
  let last;
  for (const model of GROQ_MODELS) {
    last = await tryGroqModel(apiKey, base64, mimeType, model, prompt);
    if (last.ok) return last;
    const missing = last.status === 404 || /model_not_found|not found|decommission|does not exist/i.test(last.detail || '');
    if (!missing) break; // rate limit / bad request — another model won't help
  }
  return last;
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

  const { image, candidates } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'Missing image (base64)' });
  }
  const commaIdx = image.indexOf(',');
  const base64 = commaIdx !== -1 ? image.slice(commaIdx + 1) : image;
  const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const prompt = buildPrompt(candidates);

  try {
    // Groq first: its free tier has 50x Gemini's daily cap (1,000 vs 20
    // requests/day) and, unlike Gemini's free tier, doesn't use submitted
    // data for training/human review by default. Gemini is the fallback —
    // still useful for the rare photo Groq's model can't make out, since a
    // second independent read is better than none.
    let result = groqKey
      ? await tryGroq(groqKey, base64, mimeType, prompt)
      : { ok: false, status: null, detail: 'GROQ_API_KEY not set' };

    if (!result.ok && geminiKey) {
      const geminiResult = await tryGemini(geminiKey, base64, mimeType, prompt);
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
