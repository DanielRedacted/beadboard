// In-app updates from GitHub Releases via the Tauri updater plugin.
// The app reads latest.json from the newest release, verifies the download's signature, installs and relaunches.
// Does nothing in a plain browser.
const T = window.__TAURI__;
const RELEASES = 'https://github.com/DanielRedacted/beadboard/releases/latest';
const RECHECK = 6 * 60 * 60 * 1000; // while the app stays open
const $ = s => document.querySelector(s);

export const openReleases = () => (T?.opener ? T.opener.openUrl(RELEASES) : window.open(RELEASES, '_blank'));

export function initUpdater({ flush, tell }) {
  const banner = $('#update-banner'), text = $('#update-text'), bar = $('#update-progress');
  let update = null, busy = false;

  const setButtons = mode => { // 'offer' | 'working' | 'failed'
    $('#update-now').hidden = mode !== 'offer';
    $('#update-later').hidden = mode === 'working';
    $('#update-notes').hidden = mode !== 'offer' || !update?.body;
    $('#update-github').hidden = mode !== 'failed';
    bar.hidden = mode !== 'working';
  };

  function offer(u) {
    update = u;
    text.textContent = `Beadboard ${u.version} is available (you have ${u.currentVersion}).`;
    setButtons('offer');
    banner.hidden = false;
  }

  // silent: automatic check (on launch and every few hours). Quiet when up to date or offline.
  // The check is one small JSON request, so there's no need to throttle it further.
  async function check(silent) {
    if (!T?.updater) return silent ? undefined : tell('Updates are available in the installed app only.');
    if (busy || (silent && !banner.hidden)) return;
    busy = true;
    try {
      const u = await T.updater.check();
      if (u) offer(u);
      else if (!silent) await tell(`You have the latest version (${await T.app.getVersion()}).`);
    } catch (e) {
      console.error('update check failed', e);
      if (!silent) {
        await tell(`Couldn't check for updates (${e?.message || e}). Check your internet connection, or download the latest version from GitHub.`);
      }
    } finally { busy = false; }
  }

  async function install() {
    if (!update || busy) return;
    busy = true;
    setButtons('working');
    text.textContent = 'Saving your work…';
    let total = 0, got = 0;
    try {
      await flush(); // the app restarts at the end; nothing unsaved may be left behind
      text.textContent = `Downloading Beadboard ${update.version}…`;
      bar.removeAttribute('value');
      await update.downloadAndInstall(ev => {
        if (ev.event === 'Started') total = ev.data.contentLength || 0;
        else if (ev.event === 'Progress') { got += ev.data.chunkLength; if (total) { bar.max = total; bar.value = got; } }
        else if (ev.event === 'Finished') text.textContent = 'Installing…';
      });
      text.textContent = 'Restarting…';
      await T.process.relaunch();
    } catch (e) {
      console.error('update failed', e);
      // Typical cause on macOS: the app is still running from the disk image or another read-only place.
      text.textContent = `The update couldn't be installed (${e?.message || e}). Make sure Beadboard is in your Applications folder, or download it from GitHub.`;
      setButtons('failed');
      busy = false;
    }
  }

  $('#update-now').onclick = install;
  $('#update-later').onclick = () => { banner.hidden = true; };
  $('#update-github').onclick = () => openReleases();
  $('#update-notes').onclick = () => {
    $('#notes-title').textContent = `What's new in ${update.version}`;
    $('#notes-body').textContent = update.body || '';
    $('#notes-dlg').showModal();
  };
  $('#notes-close').onclick = () => $('#notes-dlg').close();

  if (T?.updater) {
    setTimeout(() => check(true), 5000);
    setInterval(() => check(true), RECHECK);
  }
  return { check };
}
