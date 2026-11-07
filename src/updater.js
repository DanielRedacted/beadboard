// In-app updates from GitHub Releases via the Tauri updater plugin. Does nothing in a plain browser.
//
// Flow: one check when the app opens (plus the manual "Check for updates" button / menu item)
// → a banner offers the update → "Update" downloads it in the background while the user keeps working
// → on macOS it is also installed in the background (the running copy keeps working)
// → a small "Restart" button appears in the header; restarting finishes the update.
// Windows installers have to close the app, so there the install itself runs when Restart is clicked.
const T = window.__TAURI__;
const RELEASES = 'https://github.com/DanielRedacted/beadboard/releases/latest';
const WINDOWS = /Windows/i.test(navigator.userAgent);
const $ = s => document.querySelector(s);

export const openReleases = () => (T?.opener ? T.opener.openUrl(RELEASES) : window.open(RELEASES, '_blank'));

export function initUpdater({ flush, tell }) {
  const banner = $('#update-banner'), text = $('#update-text');
  const pill = $('#update-pill'), pillText = $('#update-pill-text'), restartBtn = $('#update-restart');
  let update = null;
  let state = 'idle'; // idle | checking | offered | downloading | ready | restarting

  const bannerButtons = mode => { // 'offer' | 'failed'
    $('#update-now').hidden = mode !== 'offer';
    $('#update-notes').hidden = mode !== 'offer' || !update?.body;
    $('#update-github').hidden = mode !== 'failed';
  };
  const showPill = (msg, ready) => {
    pillText.textContent = msg;
    restartBtn.hidden = !ready;
    restartBtn.disabled = false;
    pill.hidden = false;
  };

  function offer(u) {
    update = u;
    state = 'offered';
    text.textContent = `Beadboard ${u.version} is available (you have ${u.currentVersion}). It downloads in the background while you work.`;
    bannerButtons('offer');
    banner.hidden = false;
  }

  function failed(e) {
    console.error('update failed', e);
    state = 'offered'; // the same update can be retried
    pill.hidden = true;
    // Typical cause on macOS: the app is running from the disk image or another read-only place.
    text.textContent = `The update couldn't be installed (${e?.message || e}). Make sure Beadboard is in your Applications folder, or download it from GitHub.`;
    bannerButtons('failed');
    $('#update-now').hidden = false;
    $('#update-now').textContent = 'Try again';
    banner.hidden = false;
  }

  // silent = the automatic check on open: says nothing when up to date or offline.
  async function check(silent) {
    if (!T?.updater) return silent ? undefined : tell('Updates are available in the installed app only.');
    if (state === 'checking' || state === 'restarting') return;
    if (state === 'downloading') return silent ? undefined : tell('An update is already downloading in the background.');
    if (state === 'ready') return silent ? undefined : tell(`Beadboard ${update.version} is ready. Click Restart at the top of the window to finish updating.`);
    if (state === 'offered') { banner.hidden = false; return; }
    state = 'checking';
    try {
      const u = await T.updater.check();
      state = 'idle';
      if (u) offer(u);
      else if (!silent) await tell(`You have the latest version (${await T.app.getVersion()}).`);
    } catch (e) {
      state = 'idle';
      console.error('update check failed', e);
      if (!silent) await tell(`Couldn't check for updates (${e?.message || e}). Check your internet connection, or download the latest version from GitHub.`);
    }
  }

  async function download() {
    if (state !== 'offered') return;
    state = 'downloading';
    banner.hidden = true;
    showPill('Downloading update…', false);
    let total = 0, got = 0;
    try {
      await update.download(ev => {
        if (ev.event === 'Started') total = ev.data.contentLength || 0;
        else if (ev.event === 'Progress' && total) {
          got += ev.data.chunkLength;
          pillText.textContent = `Downloading update ${Math.min(100, Math.round((got / total) * 100))}%`;
        }
      });
      if (!WINDOWS) { pillText.textContent = 'Installing update…'; await update.install(); }
      state = 'ready';
      showPill(`Update ${update.version} ready`, true);
    } catch (e) { failed(e); }
  }

  async function restart() {
    if (state !== 'ready') return;
    state = 'restarting';
    restartBtn.disabled = true;
    pillText.textContent = 'Restarting…';
    try {
      await flush(); // nothing unsaved may be left behind
      if (WINDOWS) await update.install(); // the installer closes the app, updates it and reopens it
      await T.process.relaunch();
    } catch (e) { failed(e); }
  }

  $('#update-now').onclick = () => { $('#update-now').textContent = 'Update'; download(); };
  $('#update-later').onclick = () => { banner.hidden = true; };
  $('#update-github').onclick = () => openReleases();
  $('#update-notes').onclick = () => {
    $('#notes-title').textContent = `What's new in ${update.version}`;
    $('#notes-body').textContent = update.body || '';
    $('#notes-dlg').showModal();
  };
  $('#notes-close').onclick = () => $('#notes-dlg').close();
  restartBtn.onclick = restart;

  // Manual check lives in My Designs (and in the app menu), with the current version next to it.
  if (T?.updater) {
    $('#g-updates').hidden = false;
    T.app.getVersion().then(v => { $('#g-version').textContent = `Version ${v}`; }).catch(() => {});
    $('#g-check').onclick = () => check(false);
    setTimeout(() => check(true), 3000); // once, when the app opens
  }
  return { check };
}
