// Persistence. In Tauri: app-data folder (designs/<id>.json + <id>.bak, palettes/<medium>.json).
// In a plain browser (dev/testing only): localStorage + downloads + hidden file inputs.
const T = window.__TAURI__;
const BASE = T && { baseDir: T.fs.BaseDirectory.AppData };
export const native = !!T;

async function writeAtomic(path, text) {
  // Write-then-rename so a crash mid-save never leaves a half-written file.
  await T.fs.writeTextFile(path + '.tmp', text, BASE);
  await T.fs.rename(path + '.tmp', path, { oldPathBaseDir: BASE.baseDir, newPathBaseDir: BASE.baseDir });
}

async function readJson(path) {
  try { return JSON.parse(await T.fs.readTextFile(path, BASE)); } catch { return null; }
}

let ready;
const ensureDirs = () => (ready ||= Promise.all(['designs', 'palettes'].map(d => T.fs.mkdir(d, { ...BASE, recursive: true }))));

// Raw design objects, newest first. If a .json is missing but its .bak exists (crash between writes), the .bak is used.
// note: reads every design file to build the gallery; add an index file if it ever holds hundreds.
export async function listDesigns() {
  if (!T) return Object.keys(localStorage).filter(k => k.startsWith('design:')).map(k => { try { return JSON.parse(localStorage[k]); } catch { return null; } }).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
  await ensureDirs();
  const names = new Set((await T.fs.readDir('designs', BASE)).map(e => e.name)), out = [];
  for (const n of names) {
    const json = n.endsWith('.json'), orphanBak = n.endsWith('.bak') && !names.has(n.slice(0, -4) + '.json');
    if (!json && !orphanBak) continue;
    const d = await readJson('designs/' + n);
    out.push(d ?? { broken: n });
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getDesign(id) {
  if (!T) { try { return JSON.parse(localStorage['design:' + id]); } catch { return null; } }
  await ensureDirs();
  return (await readJson(`designs/${id}.json`)) ?? readJson(`designs/${id}.bak`);
}

// backup = true also refreshes <id>.bak, the version File > Revert to Saved goes back to.
export async function saveDesign(d, backup = false) {
  d.updatedAt = Date.now();
  const text = JSON.stringify(d);
  if (!T) { localStorage['design:' + d.id] = text; if (backup) localStorage['bak:' + d.id] = text; return; }
  await ensureDirs();
  await writeAtomic(`designs/${d.id}.json`, text);
  if (backup) await writeAtomic(`designs/${d.id}.bak`, text);
}

export async function saveBackup(d) {
  const text = JSON.stringify(d);
  if (!T) return void (localStorage['bak:' + d.id] = text);
  await ensureDirs();
  await writeAtomic(`designs/${d.id}.bak`, text);
}

export async function loadBackup(id) {
  if (!T) { try { return JSON.parse(localStorage['bak:' + id]); } catch { return null; } }
  return readJson(`designs/${id}.bak`);
}

export async function deleteDesign(id) {
  if (!T) { localStorage.removeItem('design:' + id); localStorage.removeItem('bak:' + id); return; }
  for (const ext of ['json', 'bak']) await T.fs.remove(`designs/${id}.${ext}`, BASE).catch(() => {});
}

export async function loadPalette(medium) {
  if (!T) { try { return JSON.parse(localStorage['palette:' + medium]); } catch { return null; } }
  await ensureDirs();
  return readJson(`palettes/${medium}.json`);
}

export async function savePalette(medium, palette) {
  const text = JSON.stringify(palette, null, 1);
  if (!T) return void (localStorage['palette:' + medium] = text);
  await ensureDirs();
  await writeAtomic(`palettes/${medium}.json`, text);
}

const KINDS = {
  image: { name: 'Images', ext: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'heif'], input: '#photo-file' },
  design: { name: 'Beadboard design', ext: ['json'], input: '#import-file' },
};
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif', json: 'application/json' };

// Ask the user for a file. Resolves to a File, or null if cancelled.
// Native dialog in Tauri (menu actions have no user gesture, so <input type=file> can't open there).
export async function pickFile(kind) {
  const k = KINDS[kind];
  if (T) {
    const path = await T.dialog.open({ multiple: false, filters: [{ name: k.name, extensions: k.ext }] });
    if (!path) return null;
    const name = path.split(/[\\/]/).pop(), ext = name.split('.').pop().toLowerCase();
    return new File([await T.fs.readFile(path)], name, { type: MIME[ext] || '' });
  }
  const input = document.querySelector(k.input);
  return new Promise(res => {
    input.onchange = () => { const f = input.files[0]; input.value = ''; res(f || null); };
    input.oncancel = () => res(null);
    input.click();
  });
}

// files: [{ name, data: Uint8Array | string }]. One file -> Save dialog; several -> pick a folder.
// Returns false if the user cancelled.
export async function saveFiles(files, filterName, ext) {
  if (!T) {
    for (const f of files) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([f.data]));
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    return true;
  }
  const write = (path, data) => (typeof data === 'string' ? T.fs.writeTextFile(path, data) : T.fs.writeFile(path, data));
  if (files.length === 1) {
    const path = await T.dialog.save({ defaultPath: files[0].name, filters: [{ name: filterName, extensions: [ext] }] });
    if (!path) return false;
    await write(path, files[0].data);
    return true;
  }
  const dir = await T.dialog.open({ directory: true, title: `Choose a folder for ${files.length} files` });
  if (!dir) return false;
  const sep = dir.includes('\\') ? '\\' : '/';
  for (const f of files) await write(dir + sep + f.name, f.data);
  return true;
}

export const ask = async msg => (T ? T.dialog.ask(msg, { title: '', kind: 'warning' }) : confirm(msg));
export const tell = async msg => (T ? T.dialog.message(msg, { title: '' }) : alert(msg));
export const printPage = () => (T ? T.core.invoke('print_page') : window.print());
export const setTitle = t => (T ? T.window.getCurrentWindow().setTitle(t).catch(() => {}) : void (document.title = t));

// Flush pending saves before the window closes.
export function onClose(fn) {
  if (T) T.window.getCurrentWindow().onCloseRequested(fn);
  else addEventListener('beforeunload', fn);
}
