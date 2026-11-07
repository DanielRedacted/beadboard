// App menus. One spec drives the native Tauri menu, the fallback in-window menu bar (used when native
// menus aren't available, e.g. a plain browser during development) and keyboard shortcuts in that fallback.
const M = window.__TAURI__?.menu;
const MAC = /Mac/.test(navigator.platform || navigator.userAgent);

// [id, label, accelerator?, 'check'?] | '-' | { pre } (native-only predefined item) | { title, items } (submenu)
const SPEC = [
  { title: 'File', items: [
    ['new', 'New Design…', 'CmdOrCtrl+N'], ['open', 'Open…', 'CmdOrCtrl+O'], '-',
    ['save', 'Save', 'CmdOrCtrl+S'], ['saveCopy', 'Save a Copy'], ['revert', 'Revert to Saved…'], '-',
    ['importPhoto', 'Import Photo…', 'CmdOrCtrl+I'], ['replacePhoto', 'Re-place Photo'], '-',
    ['exportPng', 'Export Template…', 'CmdOrCtrl+E'], ['exportFile', 'Export Design File…'], ['importFile', 'Import Design File…'], '-',
    ['print', 'Print…', 'CmdOrCtrl+P'], '-',
    ['close', 'Close Design', 'CmdOrCtrl+W'],
  ] },
  { title: 'Edit', items: [
    ['undo', 'Undo', 'CmdOrCtrl+Z'], ['redo', 'Redo', 'CmdOrCtrl+Shift+Z'], '-',
    // Without these, copy/paste stops working in text fields on macOS.
    { pre: 'Cut' }, { pre: 'Copy' }, { pre: 'Paste' }, { pre: 'SelectAll' }, '-',
    ['boardSize', 'Board Size…'], ['addColor', 'Add Color…'],
  ] },
  { title: 'View', items: [
    ['togglePhoto', 'Show Photo', 'CmdOrCtrl+Shift+P', 'check'],
    ['toggleIroned', 'Ironed Look', 'CmdOrCtrl+Shift+L', 'check'],
    ['toggleHighlight', 'Highlight Selected Color', 'CmdOrCtrl+Shift+H', 'check'],
    ['toggleNumbers', 'Row & Column Numbers', null, 'check'],
    ['toggleHeights', 'Stack Heights', null, 'check'], '-',
    ['zoomIn', 'Zoom In', 'CmdOrCtrl+='], ['zoomOut', 'Zoom Out', 'CmdOrCtrl+-'], ['fit', 'Fit to Window', 'CmdOrCtrl+0'], '-',
    ['rotLeft', 'Rotate 3D Left'], ['rotRight', 'Rotate 3D Right'], ['reset3d', 'Reset 3D View'], '-',
    { title: 'Theme', items: [['theme-auto', 'Match System', null, 'check'], ['theme-light', 'Light', null, 'check'], ['theme-dark', 'Dark', null, 'check']] },
  ] },
];

const about = version => ({ pre: { About: { name: 'Beadboard', version } } });
const appMenu = version => ({ title: 'Beadboard', items: [
  about(version), ['checkUpdates', 'Check for Updates…'], '-', { pre: 'Services' }, '-',
  { pre: 'Hide' }, { pre: 'HideOthers' }, { pre: 'ShowAll' }, '-', { pre: 'Quit' },
] });
const WINDOW_MENU = { title: 'Window', items: [{ pre: 'Minimize' }, { pre: 'Maximize' }, '-', { pre: 'Fullscreen' }] };

const handles = {}; // id -> native item, or fallback <button>
let actions = {};

function fullSpec(version) {
  if (MAC) return [appMenu(version), ...SPEC, WINDOW_MENU];
  // Windows/Linux have no app menu: Exit goes under File, About and updates under Help.
  const file = { ...SPEC[0], items: [...SPEC[0].items, '-', { pre: 'Quit' }] };
  return [file, ...SPEC.slice(1), { title: 'Help', items: [['checkUpdates', 'Check for Updates…'], '-', about(version)] }];
}

async function nativeItem(it) {
  if (it === '-') return M.PredefinedMenuItem.new({ item: 'Separator' });
  if (it.pre) return M.PredefinedMenuItem.new({ item: it.pre });
  if (it.title) return M.Submenu.new({ text: it.title, items: await Promise.all(it.items.map(nativeItem)) });
  const [id, text, accelerator, kind] = it, Kind = kind === 'check' ? M.CheckMenuItem : M.MenuItem;
  const opts = { id, text, action: () => actions[id]?.() };
  if (kind === 'check') opts.checked = false;
  // A bad accelerator would reject the whole menu; retry without it rather than lose the item.
  const item = await Kind.new(accelerator ? { ...opts, accelerator } : opts).catch(() => Kind.new(opts));
  return (handles[id] = item);
}

function fallbackMenu() {
  const bar = document.getElementById('menubar');
  bar.innerHTML = '';
  const add = (parent, items) => items.forEach(it => {
    if (it === '-') return parent.append(document.createElement('hr'));
    if (it.pre) return;
    if (it.title) {
      const det = document.createElement('details'), sum = document.createElement('summary'), box = document.createElement('div');
      sum.textContent = it.title;
      det.append(sum, box);
      add(box, it.items);
      return parent.append(det);
    }
    const [id, text, accel] = it, b = document.createElement('button');
    b.type = 'button';
    b.dataset.menu = id;
    b.innerHTML = '<span></span><kbd></kbd>';
    b.firstChild.textContent = text;
    b.lastChild.textContent = accel ? accel.replace('CmdOrCtrl+', MAC ? '⌘' : 'Ctrl+').replace('Shift+', MAC ? '⇧' : 'Shift+') : '';
    b.onclick = () => { bar.querySelectorAll('details').forEach(d => (d.open = false)); actions[id]?.(); };
    handles[id] = b;
    parent.append(b);
  });
  add(bar, SPEC);
  // Only one menu open at a time; clicking elsewhere closes them.
  bar.addEventListener('toggle', e => { if (e.target.open) bar.querySelectorAll('details').forEach(d => d !== e.target && !d.contains(e.target) && (d.open = false)); }, true);
  addEventListener('pointerdown', e => { if (!bar.contains(e.target)) bar.querySelectorAll('details').forEach(d => (d.open = false)); });
}

// Returns true when native menus are active.
export async function buildMenu(a) {
  actions = a;
  if (M) {
    try {
      const version = await window.__TAURI__.app.getVersion().catch(() => '');
      const menu = await M.Menu.new({ items: await Promise.all(fullSpec(version).map(nativeItem)) });
      await menu.setAsAppMenu();
      return true;
    } catch (e) { console.error('native menu failed, using in-window menu', e); }
  }
  fallbackMenu();
  return false;
}

// Keyboard shortcuts for the fallback menu (native menus handle their own accelerators).
export function matchShortcut(e) {
  const flat = [];
  const walk = items => items.forEach(it => (it.title ? walk(it.items) : Array.isArray(it) && it[2] && flat.push(it)));
  walk(SPEC);
  const mod = e.metaKey || e.ctrlKey;
  for (const [id, , accel] of flat) {
    const parts = accel.split('+'), key = parts.pop().toLowerCase();
    if (mod === parts.includes('CmdOrCtrl') && e.shiftKey === parts.includes('Shift') && (e.key.toLowerCase() === key || (key === '=' && e.key === '+'))) return id;
  }
  return null;
}

// state: { [id]: { enabled?, checked? } }
export function syncMenu(state) {
  for (const [id, st] of Object.entries(state)) {
    const h = handles[id];
    if (!h) continue;
    if (h instanceof HTMLElement) {
      if ('enabled' in st) h.disabled = !st.enabled;
      if ('checked' in st) h.classList.toggle('checked', !!st.checked);
      continue;
    }
    if ('enabled' in st) h.setEnabled(!!st.enabled).catch(() => {});
    if ('checked' in st && h.setChecked) h.setChecked(!!st.checked).catch(() => {});
  }
}
