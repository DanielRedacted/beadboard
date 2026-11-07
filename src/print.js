// Print from the app. Real size: cells at the medium's physical pitch, tiled across pages.
// Fit: one page per layer, scaled down. Pages are high-res PNGs sized in mm, so the printer can't distort them.
import { labels, maxHeight, stackable } from './core.js';
import { geom } from './render.js';
import { gridImage, legend, layerTitle } from './export.js';
import { printPage } from './store.js';

const PAPER = { letter: [215.9, 279.4], a4: [210, 297] };
const MARGIN = 10, HEADER = 14, S = 40; // mm, mm, px per cell in the page images

export async function printDesign(d, { mode, paper, pitchMm }) {
  const root = document.getElementById('print-root');
  root.innerHTML = '';
  document.getElementById('page-style').textContent = `@page { size: ${paper === 'a4' ? 'A4' : 'letter'} portrait; margin: ${MARGIN}mm; }`;
  const [pw, ph] = PAPER[paper], aw = pw - 2 * MARGIN, ah = ph - 2 * MARGIN - HEADER;
  const g = geom(d), keys = labels(d.cells), bond = d.lattice === 'bond' ? 0.5 : 0;
  const layers = stackable(d) && maxHeight(d.cells) > 1 ? [...Array(maxHeight(d.cells)).keys()] : [null];
  const pages = [];
  const addPage = (title, img, styleWidth) => {
    const el = document.createElement('section');
    el.className = 'print-page';
    el.innerHTML = `<header><b></b><span></span></header>`;
    el.querySelector('b').textContent = d.name;
    el.querySelector('span').textContent = title;
    if (img) { const im = new Image(); im.src = img; im.style.width = styleWidth; el.append(im); pages.push(im); }
    root.append(el);
    return el;
  };
  for (const layer of layers) {
    const lt = layerTitle(d, layer);
    if (mode === 'fit') {
      const { canvas } = gridImage(d, layer, keys, Math.max(12, Math.min(S, Math.floor(4000 / Math.max(g.w, g.h)))), 0, g.rows, 0, g.cols);
      const ratio = canvas.width / canvas.height, w = Math.min(aw, ah * ratio);
      addPage(lt, canvas.toDataURL('image/png'), `${w}mm`);
      continue;
    }
    // Cells per page, leaving room for the 1.2-cell number margin and the bond half-cell.
    const maxCol = Math.max(1, Math.floor(aw / pitchMm - 1.2 - bond));
    const maxRow = Math.max(1, Math.floor((ah / pitchMm - 1.2 - 1) / g.p) + 1);
    // Same page count, but split evenly so the last page isn't a sliver.
    const perCol = Math.ceil(g.cols / Math.ceil(g.cols / maxCol)), perRow = Math.ceil(g.rows / Math.ceil(g.rows / maxRow));
    const tiles = [];
    for (let r0 = 0; r0 < g.rows; r0 += perRow) for (let c0 = 0; c0 < g.cols; c0 += perCol) tiles.push([r0, Math.min(g.rows, r0 + perRow), c0, Math.min(g.cols, c0 + perCol)]);
    tiles.forEach(([r0, r1, c0, c1], k) => {
      const { canvas } = gridImage(d, layer, keys, S, r0, r1, c0, c1);
      const title = `${lt} · rows ${r0 + 1}–${r1}, columns ${c0 + 1}–${c1} · page ${k + 1} of ${tiles.length} · 1 cell = ${pitchMm} mm`;
      addPage(title, canvas.toDataURL('image/png'), `${(canvas.width / S) * pitchMm}mm`);
    });
  }
  const leg = addPage(layers.length > 1 ? 'Pieces (all layers)' : 'Pieces');
  const table = document.createElement('table');
  for (const e of legend(d, null, keys)) {
    const tr = table.insertRow();
    tr.insertCell().innerHTML = `<i style="background:${e.hex}"></i>`;
    tr.insertCell().textContent = e.key;
    tr.insertCell().textContent = e.name;
    tr.insertCell().textContent = e.hex;
    tr.insertCell().textContent = '×' + e.count;
  }
  leg.append(table);
  await Promise.all(pages.map(im => im.decode().catch(() => {})));
  await printPage();
}
