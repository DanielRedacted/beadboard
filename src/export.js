// Build templates: grid with a letter in every cell + a legend with counts.
import { top, counts, labels, luminance, maxHeight, stackable } from './core.js';
import { geom, drawCells, PRINT_THEME } from './render.js';
import { drawIso } from './iso.js';
import { mediumLabel } from './presets.js';
import { saveFiles } from './store.js';

const colorAtLayer = (d, layer) => (r, c) => (layer == null ? top(d.cells[r][c]) : d.cells[r][c][layer] ?? -1);

// Grid image for rows [r0,r1) x cols [c0,c1) at S px per cell, with row/column numbers in a margin.
// Returns { canvas, M } where M is the margin in px.
export function gridImage(d, layer, keys, S, r0, r1, c0, c1) {
  const g = geom(d), M = Math.round(S * 1.2), bond = d.lattice === 'bond' ? 0.5 : 0;
  const cv = document.createElement('canvas');
  cv.width = M + Math.ceil((c1 - c0 + bond) * S) + 2;
  cv.height = M + Math.ceil(((r1 - r0 - 1) * g.p + 1) * S) + 2;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const colorAt = colorAtLayer(d, layer);
  ctx.setTransform(S, 0, 0, S, M - c0 * S, M - g.y(r0) * S);
  drawCells(ctx, d, { colorAt, theme: PRINT_THEME, range: { r0, r1, c0, c1 }, solid: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(S * 0.42)}px system-ui, sans-serif`;
  const px = (r, c) => M + (g.x(r, c) - c0 + 0.5) * S, py = r => M + (g.y(r) - g.y(r0) + 0.5) * S;
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) {
    const i = d.cells[r]?.[c] ? colorAt(r, c) : -1;
    if (i < 0 || !d.palette[i]) continue;
    ctx.fillStyle = luminance(d.palette[i].hex) > 140 ? '#000' : '#fff';
    ctx.fillText(keys.get(i) ?? '?', px(r, c), py(r));
  }
  ctx.fillStyle = '#666';
  ctx.font = `${Math.round(S * 0.36)}px system-ui, sans-serif`;
  const show = n => n === 0 || (n + 1) % 5 === 0;
  for (let c = c0; c < c1; c++) if (show(c) || c === c0) ctx.fillText(c + 1, M + (c - c0 + 0.5) * S, M / 2);
  for (let r = r0; r < r1; r++) if (show(r) || r === r0) ctx.fillText(r + 1, M / 2, py(r));
  return { canvas: cv, M };
}

// [{ key, name, hex, count }] for one layer (or the whole design), most-used first.
export function legend(d, layer, keys) {
  return [...counts(d.cells, layer)].filter(([i]) => d.palette[i]).sort((a, b) => b[1] - a[1])
    .map(([i, count]) => ({ key: keys.get(i), name: d.palette[i].name, hex: d.palette[i].hex, count }));
}

export const layerTitle = (d, layer) => (layer == null ? (stackable(d) ? `${mediumLabel(d)} · top view` : mediumLabel(d)) : `Layer ${layer + 1} of ${maxHeight(d.cells)} (build bottom-up)`);

function page(d, layer, keys) {
  const g = geom(d), S = Math.max(12, Math.min(32, Math.floor(3600 / Math.max(g.w, g.h))));
  const { canvas: grid } = gridImage(d, layer, keys, S, 0, g.rows, 0, g.cols);
  const items = legend(d, layer, keys), pad = 32, rowH = 30, colW = 250;
  const width = Math.max(grid.width + 2 * pad, 3 * colW + 2 * pad);
  const perCol = Math.max(1, Math.floor((width - 2 * pad) / colW));
  const total = items.reduce((n, e) => n + e.count, 0);
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = pad + 60 + grid.height + 30 + Math.ceil(items.length / perCol) * rowH + 40 + pad;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#111';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText(d.name, pad, pad + 24);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#555';
  ctx.fillText(`${layerTitle(d, layer)} · ${g.cols} × ${g.rows} · ${total} pieces`, pad, pad + 50);
  const gy = pad + 60;
  ctx.drawImage(grid, Math.round((width - grid.width) / 2), gy);
  let y0 = gy + grid.height + 30;
  ctx.textBaseline = 'middle';
  items.forEach((e, k) => {
    const x = pad + (k % perCol) * colW, y = y0 + Math.floor(k / perCol) * rowH + rowH / 2;
    ctx.fillStyle = e.hex;
    ctx.fillRect(x, y - 11, 22, 22);
    ctx.strokeStyle = '#999';
    ctx.strokeRect(x + 0.5, y - 10.5, 21, 21);
    ctx.fillStyle = luminance(e.hex) > 140 ? '#000' : '#fff';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e.key, x + 11, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`${e.name}  ×${e.count}`, x + 30, y);
  });
  return cv;
}

const pngBytes = cv => new Promise(res => cv.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/png'));
const safe = s => (s || 'design').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'design';

export async function exportDesign(d) {
  const keys = labels(d.cells), name = safe(d.name), pages = [{ name: `${name}.png`, cv: page(d, null, keys) }];
  if (stackable(d) && maxHeight(d.cells) > 1)
    for (let k = 0; k < maxHeight(d.cells); k++) pages.push({ name: `${name} - layer ${k + 1}.png`, cv: page(d, k, keys) });
  if (d.medium === 'lego') {
    const iso = document.createElement('canvas');
    iso.width = 1600;
    iso.height = 1200;
    drawIso(iso.getContext('2d'), d, 0, iso.width, iso.height, '#ffffff');
    pages.push({ name: `${name} - 3D.png`, cv: iso });
  }
  const files = [];
  for (const p of pages) files.push({ name: p.name, data: await pngBytes(p.cv) });
  return saveFiles(files, 'PNG image', 'png');
}

export async function exportJson(d) {
  return saveFiles([{ name: `${safe(d.name)}.beadboard.json`, data: JSON.stringify(d) }], 'Beadboard design', 'json');
}
