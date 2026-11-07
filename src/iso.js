// Read-only isometric view of LEGO on a baseplate, rotatable in 90° steps, pan/zoomable.
// note: painter's algorithm sorted by column depth; fine for unit columns on a grid, no z-buffer.
import { geom, mix } from './render.js';

const COS = Math.cos(Math.PI / 6);
const PLATE = 0.4; // 3.2 mm plate on an 8 mm stud pitch
const BASE = 0.3; // baseplate thickness
const STUD_H = 0.17, STUD_R = 0.3;
const BASE_HEX = '#a0a5a9'; // Light Bluish Gray baseplate

// view = { s, ox, oy } applied on top of the auto-fit (s = 1, ox = oy = 0 is "fit").
export function drawIso(ctx, d, rot, W, H, bg, view = { s: 1, ox: 0, oy: 0 }) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const g = geom(d), part = d.part || 'plate', cols = [];
  let maxH = 0;
  d.cells.forEach((row, r) => row.forEach((s, c) => {
    if (!s) return; // outside the board: no baseplate there either
    let x = g.x(r, c) + 0.5 - g.w / 2, y = g.y(r) + 0.5 - g.h / 2;
    for (let k = 0; k < rot; k++) [x, y] = [-y, x];
    cols.push({ x, y, s });
    maxH = Math.max(maxH, s.length);
  }));
  cols.sort((a, b) => a.x + a.y - (b.x + b.y));
  const span = g.w + g.h, above = maxH * PLATE + STUD_H + 0.1;
  const s0 = 0.9 * Math.min(W / (span * COS), H / (span / 2 + above + BASE)), s = s0 * view.s;
  const X0 = W / 2 + view.ox, Y0 = H / 2 + view.oy + ((above - BASE) / 2) * s;
  const P = (x, y, z) => [X0 + (x - y) * COS * s, Y0 + (x + y) * 0.5 * s - z * s];
  ctx.lineWidth = Math.max(0.4, s * 0.025);
  ctx.strokeStyle = 'rgba(0,0,0,.22)';
  const poly = (fill, ...pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  const box = (x, y, z0, z1, hex) => {
    const a = x - 0.5, b = x + 0.5, e = y - 0.5, f = y + 0.5;
    poly(mix(hex, 0.62), P(a, f, z0), P(b, f, z0), P(b, f, z1), P(a, f, z1)); // front-left face
    poly(mix(hex, 0.8), P(b, e, z0), P(b, f, z0), P(b, f, z1), P(b, e, z1)); // front-right face
    poly(hex, P(a, e, z1), P(b, e, z1), P(b, f, z1), P(a, f, z1)); // top
  };
  // Upright cylinder: studs and round tiles. An iso circle is an ellipse with rx = r·√2·cos30, ry = r·√2·½.
  const cyl = (x, y, z0, z1, r, hex) => {
    const [cx, cy] = P(x, y, z0), h = (z1 - z0) * s, rx = r * Math.SQRT2 * COS * s, ry = r * Math.SQRT2 * 0.5 * s;
    ctx.fillStyle = mix(hex, 0.75);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, cy - h);
    ctx.ellipse(cx, cy - h, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = mix(hex, 1.08);
    ctx.beginPath();
    ctx.ellipse(cx, cy - h, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  };
  const draw = (x, y, z, hex, topmost) => {
    if (part === 'round') return cyl(x, y, z, z + PLATE, 0.48, hex);
    box(x, y, z, z + PLATE, hex);
    if (part === 'plate' && topmost) cyl(x, y, z + PLATE, z + PLATE + STUD_H, STUD_R, hex);
  };
  for (const { x, y, s: stack } of cols) {
    box(x, y, -BASE, 0, BASE_HEX);
    if (!stack.length) cyl(x, y, 0, STUD_H, STUD_R, BASE_HEX); // pieces sit over the stud and hide it
    stack.forEach((i, k) => draw(x, y, k * PLATE, d.palette[i]?.hex || '#888888', k === stack.length - 1));
  }
}

// Drag to pan, pinch or ctrl/⌘+wheel to zoom, plain wheel to pan, double-click / double-tap to reset.
export function attachPanZoom(el, view, redraw) {
  const pts = new Map();
  let g = null, lastTap = 0, downAt = null, moved = false;
  const pos = e => { const b = el.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const C = () => ({ x: el.clientWidth / 2, y: el.clientHeight / 2 });
  const reset = () => { Object.assign(view, { s: 1, ox: 0, oy: 0 }); redraw(); };
  const zoomAbout = (p, k, v0 = { ...view }) => {
    k = Math.max(0.3, Math.min(20, v0.s * k)) / v0.s;
    const c = C();
    view.s = v0.s * k;
    view.ox = p.x - c.x - k * (p.x - c.x - v0.ox);
    view.oy = p.y - c.y - k * (p.y - c.y - v0.oy);
  };
  const start = () => {
    const v = [...pts.values()];
    if (v.length === 1) g = { last: v[0] };
    else if (v.length === 2) g = { d0: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) || 1, m0: { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 }, v0: { ...view } };
    else g = null;
  };
  el.addEventListener('pointerdown', e => {
    try { el.setPointerCapture(e.pointerId); } catch {}
    if (pts.size === 0) {
      if (performance.now() - lastTap < 300) { lastTap = 0; return reset(); } // double tap / double click
      downAt = pos(e);
      moved = false;
    }
    pts.set(e.pointerId, pos(e));
    if (pts.size > 1) moved = true; // a pinch is never a tap
    start();
  });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !g) return;
    const p = pos(e);
    pts.set(e.pointerId, p);
    if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 6) moved = true;
    if (g.last) { view.ox += p.x - g.last.x; view.oy += p.y - g.last.y; g.last = p; }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const k = (Math.hypot(a.x - b.x, a.y - b.y) || 1) / g.d0, c = C();
      view.s = Math.max(0.3, Math.min(20, g.v0.s * k));
      const kk = view.s / g.v0.s;
      view.ox = m.x - c.x - kk * (g.m0.x - c.x - g.v0.ox);
      view.oy = m.y - c.y - kk * (g.m0.y - c.y - g.v0.oy);
    }
    redraw();
  });
  const up = e => {
    if (!pts.delete(e.pointerId)) return;
    if (!pts.size) lastTap = moved ? 0 : performance.now(); // only a tap that didn't pan arms the double tap
    start();
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAbout(pos(e), Math.exp(-e.deltaY * 0.01));
    else { view.ox -= e.deltaX; view.oy -= e.deltaY; }
    redraw();
  }, { passive: false });
  return { reset, zoom: k => { zoomAbout(C(), k); redraw(); } };
}
