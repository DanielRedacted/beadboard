// Top-down renderer. Works in grid units: one cell = 1 unit; caller sets the canvas transform.
import { dims, rowOffset, inBoard, top, hexToRgb, luminance } from './core.js';

// Round beads on a bond lattice pack hexagonally; LEGO never uses bond (it's disabled in the UI).
export const pitch = d => (d.lattice === 'bond' && d.medium !== 'lego' ? Math.sqrt(3) / 2 : 1);

export function geom(d) {
  const { rows, cols } = dims(d.board), p = pitch(d);
  return {
    rows, cols, p,
    w: cols + (d.lattice === 'bond' ? 0.5 : 0),
    h: (rows - 1) * p + 1,
    x: (r, c) => c + rowOffset(d.lattice, r),
    y: r => r * p,
  };
}

// Nearest cell center among the two candidate rows, and only if the point is inside that cell's box.
export function hitTest(d, gx, gy) {
  const g = geom(d), r0 = Math.floor((gy - 0.5) / g.p);
  let best = null, bd = Infinity;
  for (const r of [r0, r0 + 1]) {
    const c = Math.floor(gx - rowOffset(d.lattice, r));
    if (!inBoard(d.board, r, c)) continue;
    const dx = gx - (g.x(r, c) + 0.5), dy = gy - (g.y(r) + 0.5);
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 0.5) continue;
    const dist = dx * dx + dy * dy;
    if (dist < bd) { bd = dist; best = [r, c]; }
  }
  return best;
}

export function fitView(g, W, H, pad = 24) {
  const s = Math.max(1, Math.min((W - 2 * pad) / g.w, (H - 2 * pad) / g.h));
  return { s, ox: (W - g.w * s) / 2, oy: (H - g.h * s) / 2 };
}

export function readTheme() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  return { peg: v('--peg'), board: v('--board'), accent: v('--accent'), bg: v('--bg'), muted: v('--muted') };
}
export const PRINT_THEME = { peg: '#d4d4d4', board: '#efefef', accent: '#e2574c', bg: '#ffffff', muted: '#666666' };

export const mix = (hex, f) => { // f < 1 darkens, f > 1 lightens toward white
  const c = hexToRgb(hex).map(v => (f <= 1 ? v * f : v + (255 - v) * (f - 1)));
  return `rgb(${c.map(Math.round).join(',')})`;
};

// How a cell is drawn. solid = letter-friendly variant for templates (no holes).
export function cellStyle(d, solid = false) {
  if (d.medium === 'lego') return d.part || 'plate';
  const ironed = d.look === 'ironed';
  if (d.medium === 'perler') return solid ? (ironed ? 'fused' : 'dot') : ironed ? 'ironed' : 'ring';
  return ironed ? 'fused' : 'dot';
}

const circle = (path, x, y, r) => { path.moveTo(x + 0.5 + r, y + 0.5); path.arc(x + 0.5, y + 0.5, r, 0, 2 * Math.PI); };

function shape(path, style, x, y) {
  switch (style) {
    case 'ring': circle(path, x, y, 0.47); circle(path, x, y, 0.18); break; // raw Perler bead: tube with a hole
    case 'ironed': path.roundRect(x + 0.04, y + 0.04, 0.92, 0.92, 0.22); circle(path, x, y, 0.08); break; // flattened, hole shrinks
    case 'fused': path.roundRect(x + 0.04, y + 0.04, 0.92, 0.92, 0.22); break;
    case 'round': circle(path, x, y, 0.47); break;
    case 'plate': case 'tile': path.roundRect(x + 0.03, y + 0.03, 0.94, 0.94, style === 'tile' ? 0.06 : 0.1); break;
    default: circle(path, x, y, 0.47); // dot (fuse bead, solid template bead)
  }
}

// colorAt(r,c) -> palette index or -1. range limits rows/cols (print tiles). empty=false skips peg placeholders.
// highlight = palette index to keep bright while every other color is dimmed.
export function drawCells(ctx, d, { colorAt, theme, alpha = 1, empty = true, range, solid = false, highlight = null } = {}) {
  const g = geom(d), lego = d.medium === 'lego', style = cellStyle(d, solid);
  colorAt ||= (r, c) => top(d.cells[r][c]);
  const { r0 = 0, r1 = g.rows, c0 = 0, c1 = g.cols } = range || {};
  const byColor = new Map(), pegs = new Path2D(), pegStuds = new Path2D(), studs = new Map();
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    if (!d.cells[r]?.[c]) continue;
    const x = g.x(r, c), y = g.y(r), i = colorAt(r, c);
    if (i < 0 || !d.palette[i]) {
      if (!empty) continue;
      if (lego) { pegs.rect(x, y, 1, 1); circle(pegStuds, x, y, 0.28); } // baseplate stud
      else circle(pegs, x, y, 0.12);
      continue;
    }
    if (!byColor.has(i)) byColor.set(i, new Path2D());
    shape(byColor.get(i), style, x, y);
    if (style === 'plate') { if (!studs.has(i)) studs.set(i, new Path2D()); circle(studs.get(i), x, y, 0.28); }
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = lego ? theme.board : theme.peg;
  ctx.fill(pegs);
  if (lego) { ctx.strokeStyle = theme.peg; ctx.lineWidth = 0.05; ctx.stroke(pegStuds); }
  const edge = lego || style === 'fused' || style === 'ironed'; // flat pieces need an outline to read as separate pieces
  ctx.lineWidth = 0.04;
  ctx.strokeStyle = 'rgba(0,0,0,.22)';
  for (const [i, path] of byColor) {
    ctx.globalAlpha = alpha * (highlight == null || highlight === i ? 1 : 0.15);
    ctx.fillStyle = d.palette[i].hex;
    ctx.fill(path, 'evenodd');
    if (edge) ctx.stroke(path);
    const sp = studs.get(i);
    if (sp) { ctx.fillStyle = mix(d.palette[i].hex, 1.12); ctx.fill(sp); ctx.stroke(sp); }
  }
  ctx.restore();
}

// Row/column numbers around the board, in CSS pixels (ctx transform = dpr scale only).
export function drawNumbers(ctx, d, view, color) {
  const g = geom(d), step = view.s >= 14 ? 5 : view.s >= 6 ? 10 : 0;
  if (!step) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const show = n => n === 0 || (n + 1) % step === 0;
  for (let c = 0; c < g.cols; c++) if (show(c)) ctx.fillText(c + 1, view.ox + (c + 0.5) * view.s, view.oy - 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let r = 0; r < g.rows; r++) if (show(r)) ctx.fillText(r + 1, view.ox - 5, view.oy + (g.y(r) + 0.5) * view.s);
  ctx.restore();
}

// Small stack-height digit on LEGO plate columns taller than one plate.
export function drawHeights(ctx, d, view) {
  if (view.s < 14) return;
  const g = geom(d);
  ctx.save();
  ctx.font = `600 ${Math.round(view.s * 0.32)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  d.cells.forEach((row, r) => row.forEach((s, c) => {
    if (!s || s.length < 2) return;
    ctx.fillStyle = luminance(d.palette[s[s.length - 1]]?.hex || '#888888') > 140 ? '#000' : '#fff';
    ctx.fillText(s.length, view.ox + (g.x(r, c) + 0.1) * view.s, view.oy + (g.y(r) + 0.06) * view.s);
  }));
  ctx.restore();
}

export function drawThumb(canvas, d, theme) {
  const ctx = canvas.getContext('2d'), v = fitView(geom(d), canvas.width, canvas.height, 4);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(v.s, 0, 0, v.s, v.ox, v.oy);
  drawCells(ctx, d, { theme });
}
