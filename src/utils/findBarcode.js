import * as ZXingModule from 'html5-qrcode/third_party/zxing-js.umd.js';
import { cleanTracking, isValidTracking } from './slipNumbers.js';

const ZXing = ZXingModule.default || ZXingModule;

// Finds where a barcode sits in a photo, with no AI: a barcode is the one place
// with many hard edges in one direction and almost none in the other. Handwriting
// and printed text have edges both ways, so they cancel out. The decoder could
// not read our slips from the whole photo but reads the same barcode once cropped.
//
// gray: one brightness value per pixel, width x height.
// Returns the likeliest areas first: { x, y, w, h, barsUpright } in pixels, where
// barsUpright means the bars stand vertically, which is how the decoder needs them.
export function findBarcodeAreas(gray, width, height, maxAreas = 4) {
  const cell = Math.max(4, Math.round(Math.max(width, height) / 128));
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  const across = new Float32Array(cols * rows); // edges from upright bars
  const down = new Float32Array(cols * rows); // edges from bars lying flat
  for (let y = 1; y < height - 1; y++) {
    const row = Math.min(rows - 1, Math.floor(y / cell));
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = Math.abs(gray[i + 1] - gray[i - 1]);
      const gy = Math.abs(gray[i + width] - gray[i - width]);
      const c = row * cols + Math.min(cols - 1, Math.floor(x / cell));
      if (gx > gy) across[c] += gx - gy; else down[c] += gy - gx;
    }
  }
  const areas = [];
  for (const [map, barsUpright] of [[across, true], [down, false]]) {
    const top = map.reduce((m, v) => Math.max(m, v), 0);
    if (!top) continue;
    const seen = new Uint8Array(cols * rows);
    for (let start = 0; start < map.length; start++) {
      if (seen[start] || map[start] < top * 0.3) continue;
      // grow one patch of strong cells, stepping over small gaps
      const stack = [start];
      seen[start] = 1;
      let minC = cols, maxC = 0, minR = rows, maxR = 0, sum = 0;
      while (stack.length) {
        const c = stack.pop();
        const r = Math.floor(c / cols);
        const k = c - r * cols;
        minC = Math.min(minC, k); maxC = Math.max(maxC, k);
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        sum += map[c];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dk = -1; dk <= 1; dk++) {
            const nr = r + dr;
            const nk = k + dk;
            if (nr < 0 || nk < 0 || nr >= rows || nk >= cols) continue;
            const n = nr * cols + nk;
            if (!seen[n] && map[n] >= top * 0.3) { seen[n] = 1; stack.push(n); }
          }
        }
      }
      const along = barsUpright ? maxC - minC + 1 : maxR - minR + 1;
      if (along < 6) continue; // too short to hold a tracking number
      areas.push({
        x: minC * cell, y: minR * cell,
        w: (maxC - minC + 1) * cell, h: (maxR - minR + 1) * cell,
        barsUpright, sum,
      });
    }
  }
  return areas.sort((a, b) => b.sum - a.sum).slice(0, maxAreas);
}

// The printed number sits in a strip beside the bars, on one side or the other
// depending which way up the photo is. Each strip says how far to turn it
// clockwise so the digits read the right way up: upside down they read as junk,
// which the number check throws out.
export function digitStrips(area, width, height, depth = 0.55) {
  const inside = (s) => {
    const x = Math.max(0, s.x);
    const y = Math.max(0, s.y);
    return { ...s, x, y, w: Math.min(width - x, s.w - (x - s.x)), h: Math.min(height - y, s.h - (y - s.y)) };
  };
  const strips = area.barsUpright
    ? (() => {
      const d = Math.round(area.h * depth);
      const px = Math.round(area.w * 0.08);
      return [
        { x: area.x - px, y: area.y + area.h, w: area.w + 2 * px, h: d, turn: 0 },
        { x: area.x - px, y: area.y - d, w: area.w + 2 * px, h: d, turn: 180 },
      ];
    })()
    : (() => {
      const d = Math.round(area.w * depth);
      const py = Math.round(area.h * 0.08);
      return [
        { x: area.x - d, y: area.y - py, w: d, h: area.h + 2 * py, turn: 270 },
        { x: area.x + area.w, y: area.y - py, w: d, h: area.h + 2 * py, turn: 90 },
      ];
    })();
  return strips.map(inside).filter(s => s.w > 10 && s.h > 10);
}

// Adds the blank margin the decoder needs either side of the bars.
export function padArea(area, width, height, pad = 0.12) {
  const padX = Math.round((area.barsUpright ? area.w : area.h) * pad);
  const padY = Math.round((area.barsUpright ? area.h : area.w) * pad);
  const px = area.barsUpright ? padX : padY;
  const py = area.barsUpright ? padY : padX;
  const x = Math.max(0, area.x - px);
  const y = Math.max(0, area.y - py);
  return {
    ...area, x, y,
    w: Math.min(width - x, area.w + 2 * px),
    h: Math.min(height - y, area.h + 2 * py),
  };
}

const slipHints = () => new Map([
  [ZXing.DecodeHintType.TRY_HARDER, true],
  [ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.CODE_93,
    ZXing.BarcodeFormat.CODABAR, ZXing.BarcodeFormat.ITF, ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.UPC_A,
  ]],
]);

// One area of the photo with the bars standing upright, and nothing around it:
// html5-qrcode's scanFile adds a blank border that stops our slips reading.
function decodeArea(gray, width, area) {
  const up = area.barsUpright;
  const w = up ? area.w : area.h;
  const h = up ? area.h : area.w;
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < area.h; y++) {
    for (let x = 0; x < area.w; x++) {
      const v = gray[(area.y + y) * width + area.x + x];
      if (up) out[y * w + x] = v; else out[x * w + (area.h - 1 - y)] = v;
    }
  }
  try {
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.RGBLuminanceSource(out, w, h)));
    return cleanTracking(new ZXing.MultiFormatReader().decode(bitmap, slipHints()).getText());
  } catch {
    return null;
  }
}

// The barcode's number, or null. A code that fails the number check is only
// returned if no attempt gives a good one.
export function readBarcode(gray, width, height, areas = findBarcodeAreas(gray, width, height)) {
  let odd = null;
  for (const pad of [0.12, 0.3, 0.03]) {
    for (const area of areas) {
      const text = decodeArea(gray, width, padArea(area, width, height, pad));
      if (text && isValidTracking(text)) return text;
      if (text && text.length >= 8) odd = odd || text;
    }
  }
  return odd;
}
