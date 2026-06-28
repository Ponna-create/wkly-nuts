import { Redis } from '@upstash/redis';

const getRedis = () => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
};

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

const ALLOWED_KEYS = /^(whatsapp_|settings_|template_)/;

export default async function handler(req, res) {
  const origin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = getRedis();
  if (!redis) return res.status(500).json({ error: 'KV storage not configured' });

  try {
    if (req.method === 'GET') {
      const key = req.query.key;
      if (!key) return res.status(400).json({ error: 'Missing key parameter' });
      if (!ALLOWED_KEYS.test(key)) return res.status(403).json({ error: 'Invalid key' });
      const value = await redis.get(key);
      return res.status(200).json({ data: value });
    }

    if (req.method === 'POST') {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: 'Missing key in body' });
      if (!ALLOWED_KEYS.test(key)) return res.status(403).json({ error: 'Invalid key' });
      if (typeof value === 'string' && value.length > 10000) return res.status(413).json({ error: 'Value too large' });
      await redis.set(key, value);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
