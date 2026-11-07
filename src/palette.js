// Palette panel + add/edit color dialog.
// A design carries its own copy of the palette; the medium's saved palette (palettes/<medium>.json)
// gets every add/edit/delete/use-toggle too, so new designs start with Jess's colors.
// The selected "color" can be -1 = Empty: the pencil erases and the fill bucket clears with it.
import { counts, parseColor, rgbToHex, averageBox, removeColor } from './core.js';
import * as store from './store.js';
import { imageFromUrl, loadImageFile } from './photo.js';

const $ = s => document.querySelector(s);
const same = (a, b) => a.hex === b.hex && a.name === b.name;

export function initPalette(app) {
  const list = $('#swatches'), dlg = $('#color-dlg'), form = $('#color-form');
  const text = $('#color-text'), native = $('#color-native'), nameIn = $('#color-name'), preview = $('#color-preview');
  const pick = $('#pick-canvas'), pctx = pick.getContext('2d', { willReadFrequently: true }), loupe = $('#loupe');
  let editing = -1, pickImg = null;

  function render() {
    const d = app.design;
    list.innerHTML = '';
    if (!d) return;
    const used = counts(d.cells), placing = app.placing;
    if (!placing) {
      const e = document.createElement('button');
      e.className = 'swatch empty' + (app.color === -1 ? ' selected' : '');
      e.title = 'Empty: the pencil erases and the fill bucket clears';
      e.setAttribute('aria-label', 'Empty');
      e.onclick = () => app.setColor(-1);
      list.append(e);
    }
    d.palette.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (!placing && i === app.color ? ' selected' : '') + (p.use === false ? ' off' : '');
      b.style.setProperty('--c', p.hex);
      b.title = `${p.name} ${p.hex}` + (p.use === false ? ' (skipped for photos)' : '');
      b.setAttribute('aria-label', p.name);
      if (used.get(i)) b.dataset.count = used.get(i);
      b.onclick = () => (app.placing ? toggleUse(i) : app.setColor(i));
      b.ondblclick = () => !app.placing && open(i);
      list.append(b);
    });
    const cur = d.palette[app.color];
    $('#color-info').textContent = placing ? 'Tap colors to include or skip them for this photo.'
      : app.color === -1 ? 'Empty (erases)' : cur ? `${cur.name} · ${cur.hex}` : 'No colors yet';
    $('#btn-edit-color').disabled = !cur || placing;
    $('#btn-highlight').classList.toggle('on', !!app.highlightOn);
    $('#btn-highlight').disabled = !cur || placing;
  }

  async function syncMedium(fn) {
    const d = app.design, saved = (await store.loadPalette(d.medium).catch(() => null)) || [];
    fn(saved);
    await store.savePalette(d.medium, saved).catch(e => app.fail('Could not save palette', e));
  }

  async function toggleUse(i) {
    const p = app.design.palette[i], old = { ...p };
    if (p.use === false) delete p.use; else p.use = false;
    await syncMedium(s => { const m = s.find(x => same(x, old)); if (m) { if (p.use === false) m.use = false; else delete m.use; } });
    app.useChanged();
  }

  function setHex(hex, fromText) {
    preview.style.background = hex || 'transparent';
    if (!hex) return;
    native.value = hex;
    if (!fromText) text.value = hex;
  }

  function drawPick() {
    pctx.clearRect(0, 0, pick.width, pick.height);
    $('#pick-hint').hidden = !!pickImg;
    if (!pickImg) return;
    const k = Math.min(pick.width / pickImg.width, pick.height / pickImg.height);
    const w = pickImg.width * k, h = pickImg.height * k;
    pctx.drawImage(pickImg, (pick.width - w) / 2, (pick.height - h) / 2, w, h);
  }

  async function open(i) {
    const d = app.design;
    if (!d) return;
    editing = i;
    const p = d.palette[i];
    $('#color-title').textContent = p ? 'Edit color' : 'Add color';
    form.classList.toggle('editing', !!p);
    nameIn.value = p ? p.name : '';
    text.value = p ? p.hex : '';
    text.setCustomValidity('');
    $('#color-use').checked = !p || p.use !== false;
    setHex(p ? p.hex : '#888888');
    if (!pickImg && d.photo) pickImg = await imageFromUrl(d.photo.dataUrl).catch(() => null);
    drawPick();
    for (const x of document.querySelectorAll('dialog[open]')) x.close();
    dlg.showModal();
    text.focus();
  }

  text.oninput = () => setHex(parseColor(text.value), true);
  native.oninput = () => setHex(native.value);
  $('#pick-load').onclick = async () => {
    try {
      const f = await store.pickFile('image');
      if (f) { pickImg = (await loadImageFile(f)).img; drawPick(); }
    } catch (e) { app.fail('Could not open photo', e); }
  };

  // Picking: press and drag to sample; on touch a magnifier shows what's under the finger.
  let picking = false;
  function sampleAt(e) {
    const b = pick.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * pick.width, y = ((e.clientY - b.top) / b.height) * pick.height;
    const px = averageBox(pctx.getImageData(0, 0, pick.width, pick.height).data, pick.width, pick.height, x, y, 3);
    if (px[3] > 0) setHex(rgbToHex(px[0], px[1], px[2]));
    if (e.pointerType !== 'touch') return void (loupe.hidden = true);
    const lc = loupe.getContext('2d');
    lc.imageSmoothingEnabled = false;
    lc.clearRect(0, 0, loupe.width, loupe.height);
    lc.drawImage(pick, x - 10, y - 10, 20, 20, 0, 0, loupe.width, loupe.height);
    lc.strokeStyle = '#fff';
    lc.lineWidth = 3;
    lc.strokeRect(loupe.width / 2 - 9, loupe.height / 2 - 9, 18, 18);
    lc.strokeStyle = '#000';
    lc.lineWidth = 1;
    lc.strokeRect(loupe.width / 2 - 9, loupe.height / 2 - 9, 18, 18);
    const fb = form.getBoundingClientRect();
    loupe.style.left = `${e.clientX - fb.left - loupe.offsetWidth / 2}px`;
    loupe.style.top = `${e.clientY - fb.top - loupe.offsetHeight - 40}px`;
    loupe.hidden = false;
  }
  pick.onpointerdown = e => {
    if (!pickImg) return $('#pick-load').click();
    try { pick.setPointerCapture(e.pointerId); } catch {}
    picking = true;
    sampleAt(e);
  };
  pick.onpointermove = e => picking && sampleAt(e);
  pick.onpointerup = pick.onpointercancel = () => { picking = false; loupe.hidden = true; };

  form.onsubmit = async e => {
    e.preventDefault();
    const hex = parseColor(text.value);
    if (!hex) { text.setCustomValidity('Use #RRGGBB, RRGGBB, or R, G, B'); return text.reportValidity(); }
    text.setCustomValidity('');
    const d = app.design, name = nameIn.value.trim() || hex, old = d.palette[editing], use = $('#color-use').checked;
    const entry = { name, hex, ...(use ? {} : { use: false }) };
    if (old) {
      const before = { ...old };
      await syncMedium(s => { const m = s.find(x => same(x, before)); if (m) { delete m.use; Object.assign(m, entry); } });
      delete old.use;
      Object.assign(old, entry);
    } else {
      if (d.palette.some(x => x.hex === hex) && !(await store.ask(`This design already has a color with ${hex}. Add it anyway?`))) return;
      d.palette.push(entry);
      await syncMedium(s => { if (!s.some(x => x.hex === hex)) s.push({ ...entry }); });
      app.setColor(d.palette.length - 1);
    }
    dlg.close();
    app.changed();
  };

  // Clear every visible piece of this color from the design (undoable), so it can then be deleted.
  $('#color-clear').onclick = async () => {
    const p = app.design.palette[editing];
    if (!counts(app.design.cells).get(editing)) return store.tell(`"${p.name}" isn't used in this design.`);
    dlg.close();
    app.clearColor(editing);
  };

  $('#color-delete').onclick = async () => {
    const d = app.design, p = d.palette[editing], n = counts(d.cells).get(editing);
    if (n) return store.tell(`"${p.name}" is used ${n} times in this design. Use "Remove from design" first.`);
    if (!(await store.ask(`Delete "${p.name}" from this design and from the ${d.medium} palette?`))) return;
    d.palette.splice(editing, 1);
    removeColor(d.cells, editing);
    app.resetHistory(); // note: undo snapshots hold old indices; dropping history beats remapping them
    await syncMedium(s => { const k = s.findIndex(x => same(x, p)); if (k >= 0) s.splice(k, 1); });
    app.setColor(Math.min(app.color, d.palette.length - 1));
    dlg.close();
    app.changed();
  };
  $('#color-cancel').onclick = () => dlg.close();
  $('#btn-add-color').onclick = () => open(-1);
  $('#btn-edit-color').onclick = () => app.design?.palette[app.color] && open(app.color);
  $('#btn-highlight').onclick = () => app.toggleHighlight();

  return { render, open, clearPickImage: () => { pickImg = null; } };
}
