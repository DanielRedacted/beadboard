// Wires the editor together: state, actions (menus + buttons + keys + gestures), pointer/touch input, autosave.
import * as C from './core.js';
import { MEDIA, PARTS } from './presets.js';
import { geom, drawCells, hitTest, readTheme, fitView, drawThumb, drawNumbers, drawHeights } from './render.js';
import { drawIso, attachPanZoom } from './iso.js';
import { loadImageFile, imageFromUrl, coverFit, sampleGrid, drawPhoto } from './photo.js';
import * as store from './store.js';
import { exportDesign, exportJson } from './export.js';
import { printDesign } from './print.js';
import { initPalette } from './palette.js';
import { initBoardDialog } from './board.js';
import { buildMenu, syncMenu, matchShortcut } from './menu.js';
import { initUpdater } from './updater.js';

const $ = s => document.querySelector(s);
const cv = $('#editor'), ctx = cv.getContext('2d');
const isoCv = $('#iso'), isoCtx = isoCv.getContext('2d');

let design = null, view = { s: 20, ox: 0, oy: 0 }, tool = 'pencil', color = 0, highlightOn = false;
let undo = [], redo = [], placing = null, theme = null, action = null, photoImg = null, isoRot = 0, nativeMenu = false;
const isoView = { s: 1, ox: 0, oy: 0 };
const pref = (k, def) => (localStorage[k] == null ? def : localStorage[k] === '1');
let showNumbers = pref('numbers', true), showHeights = pref('heights', true), opacity = +(localStorage.opacity || 0.85);

const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3000); };
const fail = (what, err) => { console.error(err); toast(`${what}: ${err?.message || err}`); };
const closeDialogs = () => document.querySelectorAll('dialog[open]').forEach(d => d.close());
const highlight = () => (highlightOn && design?.palette[color] ? color : null);

// ---------- palette + board dialog ----------
const palette = initPalette({
  get design() { return design; },
  get color() { return color; },
  get placing() { return !!placing; },
  get highlightOn() { return highlightOn; },
  setColor(i) { color = i; palette.render(); syncUI(); draw(); },
  changed() { changed(); },
  resetHistory() { undo = []; redo = []; syncUI(); },
  useChanged() { palette.render(); preview(); save(); },
  clearColor(i) { pushUndo(); C.clearColor(design.cells, i); redo = []; changed(); },
  toggleHighlight: () => actions.toggleHighlight(),
  fail,
});

const boardDialog = initBoardDialog({
  theme: () => theme,
  current: () => design,
  onImport: () => actions.importFile(),
  onResize(board, lattice) {
    pushUndo();
    redo = [];
    design.cells = C.resize(design.cells, design.board, board, lattice);
    Object.assign(design, { board, lattice });
    fit();
    changed();
  },
  async onCreate({ name, medium, part, board, lattice }) {
    let pal = await store.loadPalette(medium).catch(() => null);
    if (!Array.isArray(pal) || !pal.length) { pal = structuredClone(MEDIA[medium].palette); await store.savePalette(medium, pal).catch(e => fail('Could not save palette', e)); }
    const d = { version: 1, id: crypto.randomUUID(), name, medium, part, lattice, board, palette: pal, cells: C.emptyCells(board), photo: null, look: 'raw', showPhoto: false, updatedAt: Date.now() };
    await openDesign(d);
    save();
  },
});

// ---------- theme ----------
function applyTheme() {
  const t = localStorage.theme || 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  theme = readTheme();
  syncUI();
  draw();
  draw3D();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------- touch mode: follows the pointer actually being used ----------
const setTouch = on => { if (document.body.classList.contains('touch') !== on) document.body.classList.toggle('touch', on); };
setTouch(matchMedia('(pointer: coarse)').matches);
addEventListener('pointerdown', e => setTouch(e.pointerType === 'touch'), true);

// ---------- drawing ----------
let frame = 0, isoFrame = 0;
const draw = () => { frame ||= requestAnimationFrame(() => { frame = 0; paint(); }); };
// The 3D view is redrawn on stroke end / imports / view changes, not per painted cell (it's heavy on big boards).
const draw3D = () => { if (design?.medium === 'lego') isoFrame ||= requestAnimationFrame(() => { isoFrame = 0; paint3D(); }); };

function sizeCanvas(c) {
  const dpr = devicePixelRatio || 1, w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return dpr;
}

// Keep at least a quarter of the board on screen so it can't be lost by panning.
function clampView() {
  const g = geom(design), W = cv.clientWidth, H = cv.clientHeight, bw = g.w * view.s, bh = g.h * view.s;
  const mx = Math.min(bw * 0.25, W * 0.5), my = Math.min(bh * 0.25, H * 0.5);
  view.ox = Math.min(W - mx, Math.max(mx - bw, view.ox));
  view.oy = Math.min(H - my, Math.max(my - bh, view.oy));
}

function paint() {
  const dpr = sizeCanvas(cv);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!design) return;
  clampView();
  ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);
  const hl = highlight();
  if (placing) {
    drawCells(ctx, design, { theme });
    drawPhoto(ctx, placing.img, placing.t);
    if (placing.grid) drawCells(ctx, design, { theme, alpha: opacity, empty: false, colorAt: (r, c) => placing.grid[r][c] ?? -1 });
    const g = geom(design);
    ctx.lineWidth = 2 / view.s;
    ctx.strokeStyle = theme.accent;
    ctx.strokeRect(0, 0, g.w, g.h);
  } else if (design.showPhoto && photoImg) {
    drawCells(ctx, design, { theme, colorAt: () => -1 });
    drawPhoto(ctx, photoImg, design.photo);
    drawCells(ctx, design, { theme, alpha: opacity, empty: false, highlight: hl });
  } else drawCells(ctx, design, { theme, highlight: hl });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (showNumbers) drawNumbers(ctx, design, view, theme.muted);
  if (showHeights && C.stackable(design) && !placing) drawHeights(ctx, design, view);
}

function paint3D() {
  if (design?.medium !== 'lego') return;
  const dpr = sizeCanvas(isoCv);
  isoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawIso(isoCtx, design, isoRot, isoCv.clientWidth, isoCv.clientHeight, theme.bg, isoView);
}
const iso = attachPanZoom(isoCv, isoView, draw3D);

function fit() {
  if (!design) return;
  const pad = showNumbers ? 30 : 20, bar = placing ? 90 : 0; // leave room for numbers and the placement bar
  Object.assign(view, fitView(geom(design), cv.clientWidth, cv.clientHeight - bar, pad));
  draw();
}
new ResizeObserver(() => { draw(); draw3D(); }).observe($('#stage'));

// ---------- history ----------
const snap = () => structuredClone({ cells: design.cells, board: design.board, lattice: design.lattice });
function pushUndo() { undo.push(snap()); if (undo.length > 100) undo.shift(); }
function restore(s) {
  const resized = JSON.stringify(s.board) !== JSON.stringify(design.board) || s.lattice !== design.lattice;
  Object.assign(design, s);
  if (resized) fit();
  changed();
}
function changed() { save(); palette.render(); syncUI(); draw(); draw3D(); }

// ---------- saving ----------
let saveTimer = null, dirty = false, saving = Promise.resolve();
const status = t => { $('#save-status').textContent = t; };
const timeNow = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function save() { if (!design) return; dirty = true; status('Edited'); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 600); }
// Saves are serialised so two writes never race on the same temp file.
function flush(backup = false) {
  clearTimeout(saveTimer);
  saveTimer = null;
  const d = design;
  if (!d || (!dirty && !backup)) return saving;
  dirty = false;
  status('Saving…');
  return (saving = saving.then(() => store.saveDesign(d, backup)).then(
    () => { if (d === design) status(`Saved ${timeNow()}`); },
    e => { if (d === design) { dirty = true; status('Not saved!'); } fail('Could not save', e); },
  ));
}
store.onClose(() => flush());

// ---------- open / close ----------
const knownMedia = Object.keys(MEDIA), knownParts = Object.keys(PARTS);
function normalize(d) {
  d.version ??= 1;
  d.look ??= 'raw';
  d.showPhoto ??= false;
  if (d.medium === 'lego') { d.part ??= 'plate'; if (d.board?.shape === 'rect') d.lattice = 'straight'; }
  return d;
}
const check = d => (d && !d.broken ? C.validateDesign(normalize(d), knownMedia, knownParts) : 'unreadable file');

async function openDesign(d) {
  await flush();
  if (placing) endPlacing();
  design = d ? normalize(d) : null;
  undo = []; redo = []; color = 0; photoImg = null; highlightOn = false;
  Object.assign(isoView, { s: 1, ox: 0, oy: 0 });
  palette.clearPickImage();
  if (!d) {
    localStorage.removeItem('lastDesign');
    store.setTitle('');
    status('');
  } else {
    localStorage.lastDesign = d.id;
    $('#name').value = d.name;
    store.setTitle(d.name);
    status('');
    if (d.photo) imageFromUrl(d.photo.dataUrl).then(img => { if (design === d) { photoImg = img; draw(); } }).catch(() => {});
    if (tool === 'stack' && !C.stackable(d)) setTool('pencil');
    store.saveBackup(d).catch(() => {}); // "Revert to Saved" goes back to the design as it was opened
  }
  palette.render();
  syncUI();
  requestAnimationFrame(() => { fit(); draw3D(); });
}

$('#name').onchange = () => {
  if (!design) return;
  design.name = $('#name').value.trim() || 'Untitled';
  $('#name').value = design.name;
  store.setTitle(design.name);
  save();
};

// ---------- gallery ----------
async function gallery() {
  await flush();
  const list = await store.listDesigns().catch(e => (fail('Could not list designs', e), []));
  const grid = $('#gallery');
  grid.innerHTML = '';
  const nw = document.createElement('button');
  nw.className = 'card new';
  nw.innerHTML = '<span>＋</span>New design';
  nw.onclick = () => { $('#gallery-dlg').close(); boardDialog(false); };
  grid.append(nw);
  for (const d of list) {
    const card = document.createElement('div'), err = check(d);
    card.className = 'card' + (err ? ' broken' : '');
    if (err) {
      card.innerHTML = '<b></b><small></small>';
      card.querySelector('b').textContent = d.name || d.broken || 'Damaged design';
      card.querySelector('small').textContent = `Can't open: ${err}`;
      grid.append(card);
      continue;
    }
    card.innerHTML = `<canvas width="320" height="320"></canvas><div class="meta"><div><b></b><small></small></div><button title="Back up as a file">Export</button><button class="danger" title="Delete">Delete</button></div>`;
    card.querySelector('b').textContent = d.name;
    card.querySelector('small').textContent = `${MEDIA[d.medium].label} · ${new Date(d.updatedAt).toLocaleDateString()}`;
    drawThumb(card.querySelector('canvas'), d, theme);
    card.onclick = () => { $('#gallery-dlg').close(); if (design?.id !== d.id) openDesign(d); };
    const [bk, del] = card.querySelectorAll('button');
    bk.onclick = e => { e.stopPropagation(); exportJson(d).catch(err2 => fail('Could not export', err2)); };
    del.onclick = async e => {
      e.stopPropagation();
      if (!(await store.ask(`Delete "${d.name}"? This can't be undone.`))) return;
      await store.deleteDesign(d.id).catch(err2 => fail('Could not delete', err2));
      if (design?.id === d.id) { design = null; dirty = false; await openDesign(null); }
      gallery();
    };
    grid.append(card);
  }
  if (!$('#gallery-dlg').open) { closeDialogs(); $('#gallery-dlg').showModal(); }
}
$('#g-close').onclick = () => $('#gallery-dlg').close();

// ---------- tools ----------
function setTool(t) {
  tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
}
document.querySelectorAll('[data-tool]').forEach(b => (b.onclick = () => setTool(b.dataset.tool)));
setTool('pencil');

function zoomAt(p, k) {
  const g = toGrid(p);
  if (placing) {
    const t = placing.t;
    Object.assign(t, { x: g.x - (g.x - t.x) * k, y: g.y - (g.y - t.y) * k, scale: t.scale * k });
    return preview();
  }
  view.s = Math.max(2, Math.min(160, view.s * k));
  view.ox = p.x - g.x * view.s;
  view.oy = p.y - g.y * view.s;
  draw();
}
const center = () => ({ x: cv.clientWidth / 2, y: cv.clientHeight / 2 });

// ---------- photo placement ----------
let previewFrame = 0;
function preview() {
  previewFrame ||= requestAnimationFrame(() => {
    previewFrame = 0;
    if (!placing) return;
    placing.grid = C.quantize(sampleGrid(design, placing.img, placing.t), design.palette, placing.dither);
    draw();
  });
}
function startPlacing(img, dataUrl, t) {
  closeDialogs();
  placing = { img, dataUrl, t: t ? { x: t.x, y: t.y, scale: t.scale, flip: !!t.flip } : { ...coverFit(img, geom(design)), flip: false }, dither: $('#dither').checked, grid: null };
  $('#flip').checked = placing.t.flip;
  document.body.classList.add('placing');
  palette.render();
  syncUI();
  fit();
  preview();
}
function endPlacing() {
  placing = null;
  document.body.classList.remove('placing');
  palette.render();
  syncUI();
  fit();
}
$('#dither').onchange = () => { if (placing) { placing.dither = $('#dither').checked; preview(); } };
$('#flip').onchange = () => { if (placing) { placing.t.flip = $('#flip').checked; preview(); } };
$('#opacity').oninput = () => { opacity = +$('#opacity').value; localStorage.opacity = opacity; draw(); };
$('#place-cancel').onclick = () => endPlacing();
$('#place-apply').onclick = async () => {
  const p = placing;
  const grid = C.quantize(sampleGrid(design, p.img, p.t), design.palette, p.dither);
  if (design.medium === 'lego' && C.stackable(design) && !C.isEmpty(design.cells)) {
    pushUndo();
    if (!C.slideUnder(design.cells, grid)) { undo.pop(); return store.tell(`Some columns already have ${C.MAX_LAYERS} plates, so the photo can't slide in underneath. Remove a layer there first.`); }
  } else {
    if (!C.isEmpty(design.cells) && !(await store.ask('Replace the current design with this photo?'))) return;
    pushUndo();
    C.overwrite(design.cells, grid);
  }
  redo = [];
  design.photo = { dataUrl: p.dataUrl, x: p.t.x, y: p.t.y, scale: p.t.scale, flip: p.t.flip };
  photoImg = p.img;
  palette.clearPickImage();
  endPlacing();
  changed();
};

// ---------- actions (menus, buttons, shortcuts and gestures all call these) ----------
const needDesign = fn => (...a) => (design ? fn(...a) : undefined);
const inText = () => document.activeElement?.matches?.('input:not([type=range]):not([type=checkbox]):not([type=radio]), textarea');
const actions = {
  new: () => boardDialog(false),
  open: () => gallery(),
  save: needDesign(async () => { await flush(true); toast('Saved'); }),
  saveCopy: needDesign(async () => {
    await flush();
    const copy = structuredClone(design);
    Object.assign(copy, { id: crypto.randomUUID(), name: `${design.name} copy` });
    await openDesign(copy);
    save();
    toast('Saved a copy. You are now editing the copy.');
  }),
  revert: needDesign(async () => {
    const bak = await store.loadBackup(design.id).catch(() => null);
    if (!bak || check(bak)) return store.tell('There is no saved version to go back to.');
    if (!(await store.ask(`Go back to the version saved at ${new Date(bak.updatedAt || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}? Changes since then will be lost.`))) return;
    dirty = false;
    clearTimeout(saveTimer);
    await openDesign(bak);
    save();
  }),
  importPhoto: needDesign(async () => {
    try {
      const f = await store.pickFile('image');
      if (!f) return;
      const { img, dataUrl } = await loadImageFile(f);
      startPlacing(img, dataUrl, null);
    } catch (e) { fail('Could not open photo', e); }
  }),
  replacePhoto: needDesign(async () => {
    if (!design.photo) return;
    try { startPlacing(photoImg || (await imageFromUrl(design.photo.dataUrl)), design.photo.dataUrl, design.photo); } catch (e) { fail('Could not open photo', e); }
  }),
  exportPng: needDesign(() => exportDesign(design).then(ok => ok && toast('Template saved.')).catch(e => fail('Export failed', e))),
  exportFile: needDesign(() => exportJson(design).then(ok => ok && toast('Design file saved.')).catch(e => fail('Export failed', e))),
  importFile: async () => {
    try {
      const f = await store.pickFile('design');
      if (!f) return;
      let d;
      try { d = JSON.parse(await f.text()); } catch { throw new Error("that file isn't a Beadboard design"); }
      const err = check(d);
      if (err) throw new Error(err);
      d.id = crypto.randomUUID();
      await openDesign(d);
      save();
    } catch (e) { fail('Could not import', e); }
  },
  print: needDesign(() => {
    closeDialogs();
    $('#p-pitch').value = design.pitchMm || MEDIA[design.medium].pitch;
    $('#p-paper').value = localStorage.paper || (navigator.language === 'en-US' ? 'letter' : 'a4');
    $('#print-dlg').showModal();
  }),
  close: needDesign(async () => { await openDesign(null); gallery(); }),
  undo: () => {
    if (inText()) return document.execCommand('undo');
    if (!design || placing || !undo.length) return;
    redo.push(snap());
    restore(undo.pop());
  },
  redo: () => {
    if (inText()) return document.execCommand('redo');
    if (!design || placing || !redo.length) return;
    undo.push(snap());
    restore(redo.pop());
  },
  boardSize: needDesign(() => boardDialog(true)),
  addColor: needDesign(() => palette.open(-1)),
  togglePhoto: needDesign(() => { if (!design.photo) return; design.showPhoto = !design.showPhoto; save(); syncUI(); draw(); }),
  toggleIroned: needDesign(() => { if (design.medium === 'lego') return; design.look = design.look === 'ironed' ? 'raw' : 'ironed'; save(); syncUI(); draw(); }),
  toggleHighlight: needDesign(() => { highlightOn = !highlightOn && !!design.palette[color]; palette.render(); syncUI(); draw(); }),
  toggleNumbers: () => { showNumbers = !showNumbers; localStorage.numbers = showNumbers ? '1' : '0'; syncUI(); fit(); },
  toggleHeights: () => { showHeights = !showHeights; localStorage.heights = showHeights ? '1' : '0'; syncUI(); draw(); },
  zoomIn: needDesign(() => zoomAt(center(), 1.25)),
  zoomOut: needDesign(() => zoomAt(center(), 0.8)),
  fit: needDesign(() => fit()),
  rotLeft: () => { isoRot = (isoRot + 3) % 4; draw3D(); },
  rotRight: () => { isoRot = (isoRot + 1) % 4; draw3D(); },
  reset3d: () => iso.reset(),
  checkUpdates: () => updater.check(false),
  'theme-auto': () => { localStorage.theme = 'auto'; applyTheme(); },
  'theme-light': () => { localStorage.theme = 'light'; applyTheme(); },
  'theme-dark': () => { localStorage.theme = 'dark'; applyTheme(); },
};
window.beadboard = actions; // handy for scripted UI tests
const updater = initUpdater({ flush: () => flush(), tell: store.tell });

// Buttons that mirror menu items.
const bind = (sel, id) => ($(sel).onclick = () => actions[id]());
bind('#btn-undo', 'undo'); bind('#btn-redo', 'redo');
bind('#btn-zoom-in', 'zoomIn'); bind('#btn-zoom-out', 'zoomOut'); bind('#btn-fit', 'fit');
bind('#iso-left', 'rotLeft'); bind('#iso-right', 'rotRight');
bind('#btn-photo-toggle', 'togglePhoto'); bind('#btn-ironed', 'toggleIroned');
bind('#hl-clear', 'toggleHighlight');
bind('#btn-empty-new', 'new'); bind('#btn-empty-gallery', 'open');

$('#p-cancel').onclick = () => $('#print-dlg').close();
$('#print-form').onsubmit = e => {
  e.preventDefault();
  const pitchMm = +$('#p-pitch').value, paper = $('#p-paper').value, mode = new FormData(e.target).get('mode');
  if (!(pitchMm > 0)) return;
  if (design.pitchMm !== pitchMm) { design.pitchMm = pitchMm; save(); }
  localStorage.paper = paper;
  $('#print-dlg').close();
  printDesign(design, { mode, paper, pitchMm }).catch(err => fail('Print failed', err));
};

// One place that makes buttons, body classes and menu items reflect the current state.
function syncUI() {
  const d = design, b = document.body.classList, has = !!d, lego = d?.medium === 'lego', t = localStorage.theme || 'auto';
  b.toggle('no-design', !has);
  b.toggle('lego', lego);
  b.toggle('stackable', has && C.stackable(d));
  b.toggle('beads', has && !lego);
  const photoOn = has && !!d.photo && d.showPhoto;
  $('#btn-photo-toggle').hidden = !has || !d.photo || !!placing;
  $('#btn-photo-toggle').classList.toggle('on', photoOn);
  $('#opacity-wrap').hidden = !(placing || photoOn);
  $('#opacity').value = opacity;
  $('#btn-ironed').classList.toggle('on', d?.look === 'ironed');
  const hl = highlight();
  $('#hl-chip').hidden = hl == null;
  if (hl != null) $('#hl-chip b').textContent = d.palette[hl].name;
  $('#btn-undo').disabled = !undo.length;
  $('#btn-redo').disabled = !redo.length;
  const en = v => ({ enabled: !!v });
  syncMenu({
    save: en(has), saveCopy: en(has), revert: en(has), importPhoto: en(has), replacePhoto: en(has && d.photo),
    exportPng: en(has), exportFile: en(has), print: en(has), close: en(has),
    undo: en(has && undo.length && !placing), redo: en(has && redo.length && !placing),
    boardSize: en(has && !placing), addColor: en(has),
    togglePhoto: { enabled: has && !!d.photo, checked: photoOn },
    toggleIroned: { enabled: has && !lego, checked: d?.look === 'ironed' },
    toggleHighlight: { enabled: has && !!d.palette[color], checked: hl != null },
    toggleNumbers: { enabled: true, checked: showNumbers },
    toggleHeights: { enabled: has && C.stackable(d), checked: showHeights },
    zoomIn: en(has), zoomOut: en(has), fit: en(has),
    rotLeft: en(lego), rotRight: en(lego), reset3d: en(lego),
    'theme-auto': { checked: t === 'auto' }, 'theme-light': { checked: t === 'light' }, 'theme-dark': { checked: t === 'dark' },
  });
}

// ---------- pointer input (mouse, touch and pen share one path) ----------
const pointers = new Map();
let penDown = false, tap = null;
const pos = e => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
const toGrid = (p, v = view) => ({ x: (p.x - v.ox) / v.s, y: (p.y - v.oy) / v.s });
const two = () => { const [a, b] = [...pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; };

cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  if (!design) return;
  if (e.pointerType === 'pen') penDown = true;
  else if (e.pointerType === 'touch' && penDown) return; // palm rejection while drawing with a pen
  try { cv.setPointerCapture(e.pointerId); } catch {} // throws for pointers the browser no longer tracks
  const p = pos(e);
  pointers.set(e.pointerId, p);
  // Multi-finger tap detection: two-finger tap = undo, three-finger tap = redo.
  if (e.pointerType === 'touch') {
    if (pointers.size === 1) tap = { t: performance.now(), n: 1, start: new Map([[e.pointerId, p]]), moved: false };
    else if (tap) { tap.n = Math.max(tap.n, pointers.size); tap.start.set(e.pointerId, p); }
  } else tap = null;
  if (pointers.size === 2) {
    if (action?.type === 'stroke') cancelStroke();
    const { d, m } = two();
    action = { type: 'pinch', d0: d, m0: m, view0: { ...view }, t0: placing && { ...placing.t } };
    return;
  }
  if (pointers.size > 2) return;
  if (placing) action = { type: 'movePhoto', last: p };
  else if (tool === 'hand' || e.button === 1) action = { type: 'pan', last: p };
  else startStroke(e, p);
});
cv.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const p = pos(e);
  pointers.set(e.pointerId, p);
  const s0 = tap?.start.get(e.pointerId);
  if (s0 && Math.hypot(p.x - s0.x, p.y - s0.y) > 10) tap.moved = true;
  if (!action) return;
  if (action.type === 'pinch' && pointers.size === 2) {
    const { d, m } = two(), k = d / action.d0, g0 = toGrid(action.m0, action.view0);
    if (placing) {
      const t0 = action.t0, g1 = toGrid(m);
      Object.assign(placing.t, { scale: t0.scale * k, x: g1.x - (g0.x - t0.x) * k, y: g1.y - (g0.y - t0.y) * k });
      return preview();
    }
    view.s = Math.max(2, Math.min(160, action.view0.s * k));
    view.ox = m.x - g0.x * view.s;
    view.oy = m.y - g0.y * view.s;
    return draw();
  }
  if (action.type === 'pan') { view.ox += p.x - action.last.x; view.oy += p.y - action.last.y; action.last = p; draw(); }
  else if (action.type === 'movePhoto') { placing.t.x += (p.x - action.last.x) / view.s; placing.t.y += (p.y - action.last.y) / view.s; action.last = p; preview(); }
  else if (action.type === 'stroke') strokeTo(p);
});
const lift = e => {
  if (e.pointerType === 'pen') penDown = false;
  if (!pointers.delete(e.pointerId)) return;
  if (action?.type === 'stroke') endStroke();
  else if (action?.type === 'tapTool') { const a = action; action = null; if (pointers.size === 0 && !(tap?.moved)) instant(a.mode, a.g); }
  else if (pointers.size === 0 || action?.type === 'pinch') action = null; // the finger left over from a pinch does nothing
  if (pointers.size === 0 && tap) {
    const quick = performance.now() - tap.t < 300 && !tap.moved;
    if (quick && tap.n === 2) actions.undo();
    else if (quick && tap.n === 3) actions.redo();
    tap = null;
  }
};
cv.addEventListener('pointerup', lift);
cv.addEventListener('pointercancel', lift);
cv.addEventListener('wheel', e => {
  e.preventDefault();
  if (!design) return;
  const p = pos(e);
  if (e.ctrlKey || e.metaKey) zoomAt(p, Math.exp(-e.deltaY * 0.01)); // trackpad pinch arrives as ctrl+wheel
  else if (placing) zoomAt(p, Math.exp(-e.deltaY * 0.002));
  else { view.ox -= e.deltaX; view.oy -= e.deltaY; draw(); }
}, { passive: false });

function startStroke(e, p) {
  let mode = e.button === 2 ? 'erase' : tool;
  if (mode === 'pencil' && e.shiftKey && C.stackable(design)) mode = 'stack';
  if (color === -1 && mode === 'pencil') mode = 'erase'; // Empty selected
  if (mode === 'stack' && (color === -1 || !C.stackable(design))) return;
  const g = toGrid(p);
  if (mode === 'fill' || mode === 'picker') {
    // On touch, wait for the finger to lift: it may be the first finger of a two-finger undo tap.
    if (e.pointerType === 'touch') action = { type: 'tapTool', mode, g };
    else instant(mode, g);
    return;
  }
  if (mode !== 'erase' && color !== -1 && !design.palette[color]) return toast('Add a color first.');
  pushUndo();
  action = { type: 'stroke', mode, seen: new Set(), last: g, changed: false };
  applyAt(g);
}
// One-shot tools: fill and pick.
function instant(mode, g) {
  const cell = hitTest(design, g.x, g.y);
  if (mode === 'picker') {
    if (cell) { color = C.top(design.cells[cell[0]][cell[1]]); palette.render(); syncUI(); draw(); setTool('pencil'); }
    return;
  }
  if (color !== -1 && !design.palette[color]) return toast('Add a color first.');
  pushUndo();
  action = { type: 'stroke', changed: !!cell && C.fill(design.cells, design.lattice, cell[0], cell[1], color) > 0 };
  endStroke();
}
function strokeTo(p) {
  const g = toGrid(p), l = action.last, n = Math.ceil(Math.hypot(g.x - l.x, g.y - l.y) / 0.3); // fill gaps on fast drags
  for (let i = 1; i <= n; i++) applyAt({ x: l.x + ((g.x - l.x) * i) / n, y: l.y + ((g.y - l.y) * i) / n });
  action.last = g;
}
function applyAt(g) {
  const cell = hitTest(design, g.x, g.y);
  if (!cell) return;
  const key = cell.join();
  if (action.seen.has(key)) return; // each cell changes at most once per stroke (one plate per stack drag)
  action.seen.add(key);
  const [r, c] = cell, m = action.mode;
  const ok = m === 'erase' ? C.erase(design.cells, r, c) : m === 'stack' ? C.stackOn(design.cells, r, c, color, C.layersFor(design)) : C.paint(design.cells, r, c, color);
  if (ok) { action.changed = true; draw(); }
}
function endStroke() {
  if (action.changed) { redo = []; changed(); } else undo.pop();
  action = null;
}
function cancelStroke() {
  const s = undo.pop();
  if (action.changed) Object.assign(design, s);
  action = null;
  draw();
}

// ---------- keyboard ----------
addEventListener('keydown', e => {
  if (!nativeMenu) {
    const id = matchShortcut(e);
    if (id && !(inText() && /^(undo|redo)$/.test(id))) { e.preventDefault(); return actions[id](); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); return actions.redo(); }
  }
  if (e.target.closest?.('input, select, textarea, dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (placing) { if (k === 'escape') endPlacing(); if (k === 'enter') $('#place-apply').click(); return; }
  if (!design) return;
  if (k === 'escape' && highlightOn) return actions.toggleHighlight();
  const t = { b: 'pencil', p: 'pencil', s: 'stack', e: 'erase', g: 'fill', i: 'picker', h: 'hand' }[k];
  if (t && (t !== 'stack' || C.stackable(design))) setTool(t);
});

// ---------- start ----------
applyTheme();
nativeMenu = await buildMenu(actions);
document.body.classList.toggle('no-menu', !nativeMenu);
syncUI();
{
  const last = localStorage.lastDesign && (await store.getDesign(localStorage.lastDesign).catch(() => null));
  if (last && !check(last)) await openDesign(last);
  else { await openDesign(null); gallery(); }
}
