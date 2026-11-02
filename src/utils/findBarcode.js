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
