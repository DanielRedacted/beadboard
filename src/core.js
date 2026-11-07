// Pure grid + color logic, no DOM. Tested by core.test.js (npm test).
// cells[r][c] is a stack of palette indices, bottom -> top. [] = empty peg, null = outside the board.
// Non-lego media never grow a stack past 1.

export const MAX_SIDE = 128;
export const MAX_LAYERS = 8;

// Only LEGO plates stack; tiles, round tiles and beads are one unit per cell.
export const stackable = d => d.medium === 'lego' && (d.part || 'plate') === 'plate';
export const layersFor = d => (stackable(d) ? MAX_LAYERS : 1);

export const dims = b => (b.shape === 'hex' ? { rows: 2 * b.n - 1, cols: 2 * b.n - 1 } : { rows: b.h, cols: b.w });
export const rowOffset = (lattice, r) => (lattice === 'bond' && r % 2 ? 0.5 : 0);

// Hex outline made of running-bond rows: widest row in the middle, every row centred on it.
export function hexRow(n, r) {
  const d = Math.abs(r - (n - 1));
  return { start: (d + ((n - 1) % 2) - (r % 2)) / 2, width: 2 * n - 1 - d };
}

export function inBoard(b, r, c) {
  const { rows, cols } = dims(b);
  if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
  if (b.shape !== 'hex') return true;
  const { start, width } = hexRow(b.n, r);
  return c >= start && c < start + width;
}

export function emptyCells(b) {
  const { rows, cols } = dims(b);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (inBoard(b, r, c) ? [] : null)));
}

export const top = s => (s && s.length ? s[s.length - 1] : -1);
export const each = (cells, fn) => cells.forEach((row, r) => row.forEach((s, c) => s && fn(s, r, c)));
export const isEmpty = cells => cells.every(row => row.every(s => !s || !s.length));
export const maxHeight = cells => Math.max(0, ...cells.flat().map(s => (s ? s.length : 0)));

export function neighbors(lattice, r, c) {
  if (lattice !== 'bond') return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
  const d = r % 2 ? 0 : -1; // even rows touch c-1,c in the rows above/below; odd rows touch c,c+1
  return [[r, c - 1], [r, c + 1], [r - 1, c + d], [r - 1, c + d + 1], [r + 1, c + d], [r + 1, c + d + 1]];
}

// --- edits (mutate in place, return whether anything changed) ---

// Recolor the visible (top) unit; an empty peg gets its first unit.
export function paint(cells, r, c, i) {
  const s = cells[r]?.[c];
  if (!s) return false;
  if (!s.length) return s.push(i), true;
  if (s[s.length - 1] === i) return false;
  s[s.length - 1] = i;
  return true;
}

// Lego plates only: put a plate on top. Support is guaranteed because stacks are contiguous from layer 0.
export function stackOn(cells, r, c, i, max = MAX_LAYERS) {
  const s = cells[r]?.[c];
  if (!s || s.length >= max) return false;
  s.push(i);
  return true;
}

export function erase(cells, r, c) {
  const s = cells[r]?.[c];
  if (!s || !s.length) return false;
  s.pop();
  return true;
}

// Flood fill on visible color. i = -1 clears the region instead (removes the top unit of each cell once).
export function fill(cells, lattice, r, c, i) {
  const s0 = cells[r]?.[c];
  if (!s0) return 0;
  const from = top(s0);
  if (from === i) return 0;
  const q = [[r, c]], seen = new Set();
  let n = 0;
  while (q.length) {
    const [y, x] = q.pop();
    const s = cells[y]?.[x], key = y * 1024 + x;
    if (!s || seen.has(key) || top(s) !== from) continue;
    seen.add(key);
    if (i < 0) s.pop(); else paint(cells, y, x, i);
    n++;
    q.push(...neighbors(lattice, y, x));
  }
  return n;
}

// Remove every visible unit of color i (repeatedly, so a column of that color disappears down to another color).
export function clearColor(cells, i) {
  let n = 0;
  each(cells, s => { while (s.length && s[s.length - 1] === i) { s.pop(); n++; } });
  return n;
}

// Lego photo import: slide a new layer under every column the photo covers. False (no change) if a column is full.
export function slideUnder(cells, grid) {
  let full = false;
  each(cells, (s, r, c) => { if (grid[r][c] >= 0 && s.length >= MAX_LAYERS) full = true; });
  if (full) return false;
  each(cells, (s, r, c) => { if (grid[r][c] >= 0) s.unshift(grid[r][c]); });
  return true;
}

// Other media: the photo replaces everything.
export function overwrite(cells, grid) {
  cells.forEach((row, r) => row.forEach((s, c) => { if (s) row[c] = grid[r][c] >= 0 ? [grid[r][c]] : []; }));
}

// Remove an (unused) palette color and shift higher indices down.
export function removeColor(cells, i) {
  each(cells, s => s.forEach((v, k) => { if (v > i) s[k] = v - 1; }));
}

function boardCenter(b, lattice) {
  let x = 0, y = 0, n = 0;
  const { rows, cols } = dims(b);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (inBoard(b, r, c)) { x += c + rowOffset(lattice, r); y += r; n++; }
  return { x: x / n, y: y / n };
}

// New board keeps the old content centred. On bond lattices an odd row shift must pair with a half-cell x shift.
export function resize(cells, oldB, newB, lattice) {
  const o = boardCenter(oldB, lattice), nc = boardCenter(newB, lattice);
  // Ties round away from zero on both sides so grow-then-shrink returns the original.
  const sgn = t => (t < 0 ? -1 : 1), round = t => sgn(t) * Math.round(Math.abs(t));
  const dr = round(nc.y - o.y);
  const flip = lattice === 'bond' && dr % 2 !== 0;
  const t = nc.x - o.x, dx = flip ? sgn(t) * (Math.floor(Math.abs(t)) + 0.5) : round(t);
  return emptyCells(newB).map((row, r) => row.map((s, c) => {
    if (!s) return null;
    const r0 = r - dr, c0 = c + rowOffset(lattice, r) - dx - rowOffset(lattice, r0);
    const old = cells[r0]?.[c0];
    return old ? old.slice() : [];
  }));
}

export function counts(cells, layer = null) {
  const m = new Map();
  each(cells, s => (layer == null ? s : s.slice(layer, layer + 1)).forEach(i => m.set(i, (m.get(i) || 0) + 1)));
  return m;
}

// A, B, ... Z, AA, AB ...
export function label(i) {
  let s = '';
  for (i++; i > 0; i = Math.floor(i / 26)) { i--; s = String.fromCharCode(65 + (i % 26)) + s; }
  return s;
}

// One letter per used color, most-used first, consistent across every page/layer of a design.
export function labels(cells) {
  return new Map([...counts(cells)].sort((a, b) => b[1] - a[1]).map(([i], k) => [i, label(k)]));
}

// --- color ---

export const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const clamp = v => Math.max(0, Math.min(255, v));
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(clamp(v)).toString(16).padStart(2, '0')).join('');
export const luminance = hex => { const [r, g, b] = hexToRgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; };

// Accepts #abc, abc, #aabbcc, rgb(1,2,3), "1, 2, 3", "1 2 3".
export function parseColor(s) {
  s = String(s).trim();
  let m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) return '#' + (m[1].length === 3 ? [...m[1]].map(x => x + x).join('') : m[1]).toLowerCase();
  m = s.match(/^(?:rgb\s*\(\s*)?(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/i);
  if (m && m.slice(1).every(v => +v <= 255)) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}

export function oklab([r, g, b]) {
  const lin = v => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function nearest(lab, labs) {
  let best = 0, bd = Infinity;
  labs.forEach((p, i) => {
    const d = (p[0] - lab[0]) ** 2 + (p[1] - lab[1]) ** 2 + (p[2] - lab[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// Alpha-weighted mean of an RGBA buffer over a square box. Returns [r,g,b,a]; a = 0 if nothing covered.
export function averageBox(data, w, h, cx, cy, half) {
  let r = 0, g = 0, b = 0, a = 0, n = 0;
  const x0 = Math.max(0, Math.floor(cx - half)), x1 = Math.min(w, Math.ceil(cx + half));
  const y0 = Math.max(0, Math.floor(cy - half)), y1 = Math.min(h, Math.ceil(cy + half));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const k = (y * w + x) * 4, al = data[k + 3];
    r += data[k] * al; g += data[k + 1] * al; b += data[k + 2] * al; a += al; n++;
  }
  return a ? [r / a, g / a, b / a, a / n] : [0, 0, 0, 0];
}

// samples[r][c] = [r,g,b,a] | null (outside board). Returns palette index, -1 (transparent -> empty), or null.
// Nearest color in OKLab; optional Floyd-Steinberg error diffusion in RGB.
// note: dithering walks the storage grid, so bond rows diffuse to slightly-off neighbours; invisible at bead scale.
// Colors with use === false are skipped (the kit doesn't have them, or they cause speckle).
export function quantize(samples, palette, dither = false) {
  const on = palette.map((p, i) => i).filter(i => palette[i].use !== false);
  const rgbs = on.map(i => hexToRgb(palette[i].hex)), labs = rgbs.map(oklab);
  const err = samples.map(row => row.map(() => [0, 0, 0]));
  const spread = (r, c, d, f) => { const e = err[r]?.[c]; if (e) for (let k = 0; k < 3; k++) e[k] += d[k] * f; };
  return samples.map((row, r) => row.map((px, c) => {
    if (!px) return null;
    if (px[3] < 128 || !labs.length) return -1;
    const want = [0, 1, 2].map(k => clamp(px[k] + err[r][c][k]));
    const k = nearest(oklab(want), labs);
    if (dither) {
      const d = want.map((v, j) => v - rgbs[k][j]);
      spread(r, c + 1, d, 7 / 16); spread(r + 1, c - 1, d, 3 / 16); spread(r + 1, c, d, 5 / 16); spread(r + 1, c + 1, d, 1 / 16);
    }
    return on[k];
  }));
}

// Structural check for a design loaded from disk or imported. Returns an error message, or null if usable.
// Guards the renderer against hand-edited or corrupt files; it does not enforce UI policy.
export function validateDesign(d, media, parts) {
  if (!d || typeof d !== 'object') return 'not a design';
  if (!media.includes(d.medium)) return `unknown medium "${d.medium}"`;
  if (d.medium === 'lego' && d.part != null && !parts.includes(d.part)) return `unknown LEGO part "${d.part}"`;
  const b = d.board, int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!b || !(b.shape === 'hex' ? int(b.n, 1, (MAX_SIDE + 1) / 2) : b.shape === 'rect' && int(b.w, 1, MAX_SIDE) && int(b.h, 1, MAX_SIDE))) return 'bad board size';
  if (!['straight', 'bond'].includes(d.lattice)) return 'bad row layout';
  if (b.shape === 'hex' && d.lattice !== 'bond') return 'hexagon boards need offset rows';
  if (!Array.isArray(d.palette) || !d.palette.every(p => p && typeof p.name === 'string' && /^#[0-9a-f]{6}$/i.test(p.hex))) return 'bad palette';
  const { rows, cols } = dims(b), max = layersFor(d);
  if (!Array.isArray(d.cells) || d.cells.length !== rows) return 'grid does not match board';
  for (let r = 0; r < rows; r++) {
    const row = d.cells[r];
    if (!Array.isArray(row) || row.length !== cols) return 'grid does not match board';
    for (let c = 0; c < cols; c++) {
      const s = row[c];
      if (!inBoard(b, r, c)) { if (s !== null) return 'grid does not match board shape'; continue; }
      if (!Array.isArray(s) || s.length > max) return 'bad cell';
      if (!s.every(i => int(i, 0, d.palette.length - 1))) return 'cell uses a missing color';
    }
  }
  return null;
}
