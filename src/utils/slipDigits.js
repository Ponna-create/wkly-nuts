// Backup for when a slip's barcode can't be read: reads the number printed beside
// the bars. Runs on her own computer, no online service. Its reading program is
// only downloaded the first time a slip needs it.
//
// One read isn't enough: a real slip's ...265 was once read as ...206, which
// still passes the number check. So a number is only accepted when two separate
// reads agree. A number read just once comes back as a candidate for her to compare.
import { digitStrips } from './findBarcode';
import { isValidTracking } from './slipNumbers';

const LOOK_ALIKES = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };
export function numberFromText(raw) {
  const text = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const post = text.match(/[A-Z]{2}\d{9}IN/);
  if (post) return post[0];
  const digits = text.replace(/[A-Z]/g, c => LOOK_ALIKES[c] || '');
  return (digits.match(/6\d{10}/g) || []).find(isValidTracking) || null;
}

let workerPromise = null;
const getWorker = () => {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(async ({ createWorker }) => {
      const worker = await createWorker('eng');
      await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' });
      return worker;
    }).catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
};

// A strip of the photo, turned upright, tilted a little, enlarged and with its
// contrast stretched, which is what the reader needs from a WhatsApp photo.
function stripCanvas(source, strip, tilt) {
  const quarter = strip.turn === 90 || strip.turn === 270;
  const uprightW = quarter ? strip.h : strip.w;
  const uprightH = quarter ? strip.w : strip.h;
  const scale = Math.min(4, Math.max(1, 120 / uprightH));
  const rad = (tilt * Math.PI) / 180;
  const w = uprightW * scale;
  const h = uprightH * scale;
  const c = document.createElement('canvas');
  c.width = Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)));
  c.height = Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(rad + (strip.turn * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.drawImage(source, strip.x, strip.y, strip.w, strip.h, -strip.w / 2, -strip.h / 2, strip.w, strip.h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const counts = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    counts[d[i]]++;
  }
  const clip = (d.length / 4) * 0.02;
  let low = 0; let high = 255;
  for (let seen = 0; low < 255 && seen + counts[low] <= clip; low++) seen += counts[low];
  for (let seen = 0; high > 0 && seen + counts[high] <= clip; high--) seen += counts[high];
  const span = Math.max(1, high - low);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - low) * 255) / span));
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// { agreed, candidates }: agreed is a number two reads gave; candidates are
// numbers read only once, or nothing. Never throws: no result just means she
// sees the other ways to get the number.
export async function readPrintedNumber(source, areas) {
  const votes = {};
  try {
    const worker = await getWorker();
    for (const tilt of [0, -4, 4]) {
      for (const area of areas.slice(0, 2)) {
        for (const depth of [0.55, 0.85]) {
          for (const strip of digitStrips(area, source.width, source.height, depth)) {
            const { data } = await worker.recognize(stripCanvas(source, strip, tilt));
            const found = numberFromText(data.text);
            if (!found) continue;
            votes[found] = (votes[found] || 0) + 1;
            if (votes[found] >= 2) return { agreed: found, candidates: Object.keys(votes).filter(n => n !== found) };
          }
        }
      }
    }
  } catch (err) {
    console.error('Printed number reader:', err);
  }
  return { agreed: null, candidates: Object.keys(votes) };
}
