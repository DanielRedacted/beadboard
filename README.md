# Beadboard

Built and maintained as a gift for my sister. Don't tell her before Christmas.

Desktop app for designing Perler / water-fuse bead and LEGO 1×1 mosaics: turn a photo into a buildable template, or draw freehand. Runs on macOS and Windows, and updates itself.

## Download

Get the latest version from **[Releases](https://github.com/DanielRedacted/beadboard/releases/latest)**:

- **Mac:** `Beadboard_x.y.z_universal.dmg` (Apple silicon and Intel). Open it and drag Beadboard into **Applications**. Run it from Applications, not from the disk image, or updates can't install.
- **Windows:** `Beadboard_x.y.z_x64-setup.exe`.

The app isn't code-signed, so the first launch shows a warning:

- **macOS:** "can't be opened because Apple cannot check it". Right-click the app, choose **Open**, then **Open** again. If macOS says it's damaged, run `xattr -cr /Applications/Beadboard.app` once in Terminal.
- **Windows:** "Windows protected your PC". Click **More info**, then **Run anyway**.

After that, Beadboard checks for updates each time it opens. Clicking **Update** downloads the new version in the background while you keep working, then a **Restart** button appears at the top of the window. To check by hand, use **Check for updates** in My Designs, **Beadboard > Check for Updates…** on Mac, or **Help > Check for Updates…** on Windows.

## Develop

```
npm install
npm run dev      # run the app
npm test         # logic tests (src/core.js)
```

The frontend is the static `src/` folder (plain JavaScript, no bundler). Opening it through any local web server also works for quick UI checks; it falls back to localStorage, downloads and an in-window menu bar.

A local `npm run build` needs the updater signing key in the environment:

```
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/beadboard.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ~/.tauri/beadboard.key.password)"
npm run build
```

## Release

```
npm run release -- 0.3.1 "Fixed the round tile preview"
```

This sets the version everywhere, commits, tags `v0.3.1` and pushes. GitHub Actions builds the Mac and Windows installers, publishes the release (the notes appear in the app as "What's new"), and installed copies offer the update on their next check.

The signing key lives in `~/.tauri/` and in the repo's Actions secrets. **Back up `~/.tauri/beadboard.key` and its password.** Without them, installed apps can never accept another update and would need a manual reinstall.

## Where data lives

Designs and palettes are saved to the app-data folder named after the bundle identifier `com.beadboard.desktop`: `~/Library/Application Support/com.beadboard.desktop/` on macOS, `%APPDATA%\com.beadboard.desktop\` on Windows. Don't change the identifier, or the app will look in a new, empty folder.

Each design is `designs/<id>.json`. `designs/<id>.bak` is the last explicit save, used by File > Revert to Saved. File > Export Design File backs a design up anywhere.
