// Visual "New design" / "Board size" dialog: medium cards, LEGO part cards, board preset cards, live preview.
import * as C from './core.js';
import { MEDIA, PARTS } from './presets.js';
import { drawCells, drawThumb, fitView, geom } from './render.js';

const $ = s => document.querySelector(s);
const SAMPLE = [{ name: 'a', hex: '#e2574c' }, { name: 'b', hex: '#f2cd37' }, { name: 'c', hex: '#3370c0' }];

// Concentric rings in three colors, so cards and the preview show what the medium looks like.
function sample(medium, part, board, lattice) {
  const cells = C.emptyCells(board), { rows, cols } = C.dims(board);
  const cy = (rows - 1) / 2, cx = (cols - 1) / 2, R = Math.max(1, Math.min(rows, cols) / 2);
  C.each(cells, (s, r, c) => { const d = Math.hypot(r - cy, c - cx) / R; if (d < 0.98) s.push(d < 0.4 ? 0 : d < 0.7 ? 1 : 2); });
  return { medium, part, board, lattice, palette: SAMPLE, cells, look: 'raw' };
}

export function initBoardDialog({ theme, current, onCreate, onResize, onImport }) {
  const dlg = $('#board-dlg'), form = $('#board-form'), pv = $('#b-preview');
  let st = null, edit = false;

  const custom = () => st.preset === 'custom';
  const sizes = () => MEDIA[st.medium].sizes;

  function card(container, { label, sub, selected, draw, onClick }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (selected ? ' selected' : '');
    b.setAttribute('aria-pressed', !!selected);
    const cv = document.createElement('canvas');
    cv.width = 192;
    cv.height = 128;
    b.append(cv);
    const t = document.createElement('b');
    t.textContent = label;
    b.append(t);
    if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
    b.onclick = onClick;
    container.append(b);
    draw?.(cv);
  }

  function applyPreset(i) {
    const p = sizes()[i];
    st.preset = i;
    st.board = structuredClone(p.board);
    st.lattice = p.lattice || MEDIA[st.medium].lattice;
  }

  function render() {
    const th = theme();
    form.classList.toggle('edit', edit);
    form.classList.toggle('lego', st.medium === 'lego');
    form.classList.toggle('custom', custom());
    const media = $('#b-media');
    media.innerHTML = '';
    for (const [k, m] of Object.entries(MEDIA)) card(media, {
      label: m.label, selected: st.medium === k,
      draw: cv => drawThumb(cv, sample(k, 'plate', { shape: 'rect', w: 6, h: 4 }, 'straight'), th),
      onClick: () => { st.medium = k; applyPreset(0); render(); },
    });
    const parts = $('#b-parts');
    parts.innerHTML = '';
    for (const [k, p] of Object.entries(PARTS)) card(parts, {
      label: p.label, sub: k === 'plate' ? 'Stackable' : 'Flat, one layer', selected: st.part === k,
      draw: cv => drawThumb(cv, sample('lego', k, { shape: 'rect', w: 6, h: 4 }, 'straight'), th),
      onClick: () => { st.part = k; render(); },
    });
    const presets = $('#b-presets');
    presets.innerHTML = '';
    sizes().forEach((p, i) => {
      const { rows, cols } = C.dims(p.board);
      card(presets, {
        label: p.board.shape === 'hex' ? `Hexagon ${p.board.n}` : `${cols} × ${rows}`, sub: p.label, selected: st.preset === i,
        draw: cv => drawThumb(cv, sample(st.medium, st.part, p.board, p.lattice || MEDIA[st.medium].lattice), th),
        onClick: () => { applyPreset(i); render(); },
      });
    });
    card(presets, { label: 'Custom…', sub: 'Any size up to 128', selected: custom(), onClick: () => { st.preset = 'custom'; render(); $('#b-custom').scrollIntoView({ block: 'nearest' }); } });
    // Fields always mirror the current board, so "Custom" starts from the last preset.
    $('#b-shape').value = st.board.shape;
    $('#b-w').value = st.board.w ?? 29;
    $('#b-h').value = st.board.h ?? 29;
    $('#b-n').value = st.board.n ?? 15;
    $('#b-lattice').value = st.lattice;
    syncFields();
  }

  function syncFields() {
    const hex = st.board.shape === 'hex', lego = st.medium === 'lego';
    form.classList.toggle('hex', hex);
    $('#b-lattice').disabled = hex; // hexagon outlines only exist on offset rows
    for (const id of ['#b-w', '#b-h']) $(id).required = custom() && !hex;
    $('#b-n').required = custom() && hex;
    if (lego) { st.board.shape === 'hex' && (st.board = { shape: 'rect', w: 32, h: 32 }); st.lattice = 'straight'; }
    preview();
  }

  function readFields() {
    const shape = st.medium === 'lego' ? 'rect' : $('#b-shape').value;
    st.board = shape === 'hex' ? { shape, n: +$('#b-n').value } : { shape, w: +$('#b-w').value, h: +$('#b-h').value };
    st.lattice = shape === 'hex' ? 'bond' : st.medium === 'lego' ? 'straight' : $('#b-lattice').value;
    $('#b-lattice').value = st.lattice;
    syncFields();
  }
  for (const id of ['#b-shape', '#b-w', '#b-h', '#b-n', '#b-lattice']) $(id).addEventListener('input', readFields);

  const valid = () => {
    const { rows, cols } = C.dims(st.board);
    return Number.isInteger(rows) && Number.isInteger(cols) && rows >= 1 && cols >= 1 && rows <= C.MAX_SIDE && cols <= C.MAX_SIDE;
  };

  function preview() {
    const dpr = devicePixelRatio || 1, W = pv.clientWidth, H = pv.clientHeight;
    pv.width = Math.round(W * dpr);
    pv.height = Math.round(H * dpr);
    const ctx = pv.getContext('2d');
    ctx.clearRect(0, 0, pv.width, pv.height);
    const sum = $('#b-summary');
    if (!valid()) { sum.textContent = `Boards can be 1 to ${C.MAX_SIDE} cells per side.`; return; }
    const d0 = current();
    const d = edit
      ? { ...d0, board: st.board, lattice: st.lattice, cells: C.resize(d0.cells, d0.board, st.board, st.lattice) }
      : sample(st.medium, st.part, st.board, st.lattice);
    const g = geom(d), v = fitView(g, W, H, 12);
    ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.ox, dpr * v.oy);
    drawCells(ctx, d, { theme: theme() });
    const n = C.emptyCells(st.board).flat().filter(Boolean).length, mm = (edit && d0.pitchMm) || MEDIA[st.medium].pitch;
    const cm = x => (x * mm / 10).toFixed(1);
    sum.textContent = `${g.cols} × ${g.rows} · ${n} pegs · about ${cm(g.w)} × ${cm(g.h)} cm`;
  }
  new ResizeObserver(() => dlg.open && preview()).observe(pv);

  form.onsubmit = e => {
    e.preventDefault();
    if (custom()) readFields();
    if (!valid()) return;
    dlg.close();
    const name = $('#b-name').value.trim() || 'Untitled';
    if (edit) onResize(st.board, st.lattice);
    else { localStorage.lastMedium = st.medium; onCreate({ name, medium: st.medium, part: st.medium === 'lego' ? st.part : undefined, board: st.board, lattice: st.lattice }); }
  };
  $('#b-cancel').onclick = () => dlg.close();
  $('#b-import').onclick = () => { dlg.close(); onImport(); };

  return function open(isEdit) {
    edit = isEdit;
    const d = current();
    if (edit) {
      st = { medium: d.medium, part: d.part, board: structuredClone(d.board), lattice: d.lattice, preset: null };
      const i = sizes().findIndex(p => JSON.stringify(p.board) === JSON.stringify(d.board) && (p.lattice || MEDIA[d.medium].lattice) === d.lattice);
      st.preset = i >= 0 ? i : 'custom';
    } else {
      const m = MEDIA[localStorage.lastMedium] ? localStorage.lastMedium : 'perler';
      st = { medium: m, part: 'plate' };
      applyPreset(0);
      $('#b-name').value = '';
    }
    $('#board-title').textContent = edit ? 'Board size' : 'New design';
    $('#b-ok').textContent = edit ? 'Apply' : 'Create';
    for (const x of document.querySelectorAll('dialog[open]')) x.close();
    dlg.showModal();
    render();
  };
}
