// Reads a courier slip photo with Gemini (multimodal LLM), server-side only
// — the API key must never reach the browser. Switched from Google Cloud
// Vision's plain TEXT_DETECTION because that's character-recognition OCR
// with no idea what it's looking at: it garbled messy handwritten names into
// nonsense (random Cyrillic/CJK characters) since it was just guessing at
// scripts. Gemini actually reads the slip the way a person would — it knows
// the squiggle in the "To:" box is a name — and extracts the fields
// directly instead of us regexing a raw OCR text blob afterward.

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

const PROMPT = `You are reading a courier consignment slip (ST Courier, India) from a photo. Some fields are handwritten and messy — read them carefully and use context (this is a shipping slip) to infer what they say, the way a person would, rather than transcribing stray marks literally.

Extract these fields as JSON:
- trackingNumber: the printed CONSIGNMENT NUMBER, 11-12 digits, printed under the barcode (this is machine-printed, not handwritten)
- customerName: the handwritten name in the "To:" / "Receiver's Full Name" box
- phone: the handwritten mobile number in the "To: Mobile:" box, digits only, or null if not legible
- weight: the weight in KG as a number, or null
- amount: the number written in the Cash or Credit box (the shipping amount collected), or null
- date: the DATE field, normalized to YYYY-MM-DD (if no year is shown, assume 2026), or null
- rawText: every other word/number you can make out on the slip, space-separated, for fallback matching

If a field genuinely isn't visible or you're not confident, use null rather than guessing. Respond with ONLY the JSON object.`;

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
  // Strip a data: URL prefix if the client sent one whole
  const commaIdx = image.indexOf(',');
  const base64 = commaIdx !== -1 ? image.slice(commaIdx + 1) : image;
  const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  try {
    const geminiRes = await fetch(
      // "-latest" alias always points at the current recommended Flash
      // model, so this doesn't silently break again the next time Google
      // retires a model version (gemini-2.0-flash, used here originally,
      // was retired March 2026).
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
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
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                trackingNumber: { type: 'STRING', nullable: true },
                customerName: { type: 'STRING', nullable: true },
                phone: { type: 'STRING', nullable: true },
                weight: { type: 'NUMBER', nullable: true },
                amount: { type: 'NUMBER', nullable: true },
                date: { type: 'STRING', nullable: true },
                rawText: { type: 'STRING', nullable: true },
              },
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'Slip reading request failed' });
    }

    const data = await geminiRes.json();
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let fields;
    try {
      fields = JSON.parse(jsonText);
    } catch {
      fields = {};
    }

    return res.status(200).json({
      trackingNumber: fields.trackingNumber || null,
      customerName: fields.customerName || null,
      phone: fields.phone || null,
      weight: fields.weight ?? null,
      amount: fields.amount ?? null,
      date: fields.date || null,
      rawText: fields.rawText || '',
    });
  } catch (error) {
    console.error('scan-slip error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
