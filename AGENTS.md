# AGENTS.md

Guide for coding agents working on Beadboard. Read this first, then `graphify-out/GRAPH_REPORT.md`.

## What this is

A Tauri v2 desktop app (macOS + Windows) for designing Perler, water-fuse bead and LEGO 1×1 mosaics. The frontend is plain JavaScript ES modules in `src/` with no bundler and no framework. Rust (`src-tauri/`) only registers plugins and a print command. The user is non-technical, so UX and data safety matter more than cleverness.

## Use the code graph before reading files

`graphify-out/graph.json` is a knowledge graph of this repo. It holds about 370 nodes: functions, modules, config and README concepts, with call and import edges and named communities. Querying it is much cheaper than opening files to find your way around.

1. **Orient:** skim `graphify-out/GRAPH_REPORT.md` for communities, hub nodes and surprising links.
2. **Ask:** use the CLI, and keep `--budget` small; raise it only if the output says it truncated.

```
graphify query "how is a photo turned into palette colors" --budget 800
graphify explain "drawCells()"          # a node and its neighbours
graphify path "startStroke()" "saveDesign()"   # how A reaches B
graphify affected "geom()" --depth 2    # what breaks if you change this
graphify god-nodes --top 10             # hubs: change these with care
```

Exit codes: 0 means an answer, 3 means the name is ambiguous (candidates are listed), and 4 means no match. On 4, retry with words that appear in node labels; the matcher does substring matching with no synonyms.

3. **Then read** only the files and line ranges the graph points at (`src=… loc=L…`).

**Skip the graph** for a single exact lookup such as "where is X defined". There, `grep` is as fast. The graph pays off for "how does X flow to Y", "what depends on X" and first-time orientation.

### Community map

| Community | Main files |
|---|---|
| UI Controller & Canvas Events | `src/app.js`: state, actions, pointer/touch input, autosave |
| Mosaic Grid Core Logic | `src/core.js`: pure grid, stack, color and validation logic |
| Design Export & Rendering | `src/render.js`, `src/iso.js`, `src/export.js`, `src/print.js` |
| Design Storage & Persistence | `src/store.js`: app-data files, backups, file pickers |
| Board Dialog & Presets | `src/board.js`, `src/presets.js` |
| App Menu & Shortcuts | `src/menu.js`: one spec drives native menus, fallback menu and shortcuts |
| Auto-Update Logic | `src/updater.js` |
| Release CI / Release Script | `.github/workflows/release.yml`, `scripts/release.mjs` |
| Tauri config / capabilities | `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json` |

`geom()`, `drawCells()` and `initPalette()` are the most-connected nodes. Run `graphify affected` on them before changing their signatures.

## Keep the graph current

The graph is committed so every machine and every agent shares it. Stale graphs mislead, so update it in the same commit as your change.

- **After code changes (`.js`, `.mjs`, `.rs`, `.json`, `.toml`, `.yml`):** run `graphify update .` and commit `graphify-out/` with your change. It re-parses only changed files, needs no LLM and keeps community names.
- **After deleting or moving code**, the update may refuse to shrink the graph. If the shrink is intended, run `graphify update . --force`.
- **After doc changes (`README.md`, `src/index.html`):** those need semantic extraction, which costs LLM tokens. Run the graphify skill's `--update` flow in an agent that has it, or `graphify extract . --backend gemini` with `GEMINI_API_KEY` set. Doc results are cached by content hash in `graphify-out/cache/semantic/`, which is committed, so unchanged docs are never re-extracted on any machine.
- **New communities named "Community N"** after a big change: run `graphify label . --missing-only` to name only the new ones.
- `.graphifyignore` excludes this file from the graph; describing the graph inside the graph adds cost and no value.
- Commit only what `.gitignore` lets through in `graphify-out/`. Interpreter paths, stat caches, backups and `graph.html` stay local. Regenerate the HTML with `graphify export html` when you want the visual.

## Commands

```
npm install
npm run dev        # run the app (Tauri dev)
npm test           # node --test: logic tests for src/core.js. Keep them passing; add a case for new core logic.
npm run release -- X.Y.Z "notes"   # the ONLY way to bump versions and ship
```

A local `npm run build` needs the updater signing key in the environment; see README.

## Rules

- **Commits:** plain, human-style messages. **No AI attribution of any kind** (no `Co-Authored-By` trailers, no "Generated with" lines) in commits, tags, release notes or PRs. This is the maintainer's standing instruction.
- **Never commit secrets:** the updater key lives in `~/.tauri/` and in Actions secrets. Only the *public* key belongs in `tauri.conf.json`.
- **Never touch real user data.** The live app data is in `~/Library/Application Support/com.beadboard.desktop/`. For in-app tests run `npm run tauri dev -- --config '{"identifier":"com.beadboard.selftest"}'`, which uses a separate folder; delete it afterwards.
- **Don't change the bundle identifier** (`com.beadboard.desktop`). It is the data folder's name, and existing installs would appear empty.
- **Versions** live in `tauri.conf.json`, `package.json`, `package-lock.json`, `Cargo.toml` and `Cargo.lock`. Only `scripts/release.mjs` changes them. A release must be newer than the installed version or the updater ignores it.
- **Design files are user data:** `src/core.js` → `validateDesign()` guards every load. When you change the data model, keep old files loading by adding a default in `normalize()` in `src/app.js`, not a breaking change.

## Product decisions already made (don't relitigate)

- All actions live in native menus (`src/menu.js` spec). The window title is the design name; the app name appears only in the OS app menu.
- Cells are stacks of palette indices: `[]` means empty and `null` means outside the board. Only LEGO **plates** stack, up to 8. Square and round tiles and beads are one unit per cell.
- LEGO never uses running bond or hexagon boards. Hexagon boards always use offset rows.
- The top view edits only the visible top piece. Stacking uses the Stack tool or a shift-click.
- Photo import on stackable LEGO slides a layer *under* every column. Every other medium overwrites the grid after a confirm.
- There is one saved palette per medium (`palettes/<medium>.json`), and every design embeds its own palette copy.
- Touch mode follows the last pointer type used. A two-finger tap undoes and a three-finger tap redoes. On touch, the fill and pick tools fire when the finger lifts.
- Updates: one silent check when the app opens, plus the manual "Check for updates" button in My Designs and the menu item. Never add periodic checks. Clicking Update downloads in the background, and on macOS also installs; the user keeps working, and a header Restart button finishes it. On Windows, install runs at Restart because the installer must close the app.
- Autosave runs about 600 ms after edits. File > Save also writes `<id>.bak`, which Revert to Saved restores. Writes are atomic: temp file, then rename.
