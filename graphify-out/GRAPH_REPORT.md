# Graph Report - jess-gift  (2026-11-07)

## Corpus Check
- 26 files · ~18,680 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .icns 1, .ico 1)

## Summary
- 371 nodes · 698 edges · 19 communities (14 shown, 5 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4063b6e9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- UI Controller & Canvas Events
- initPalette
- Release CI Workflow
- core.js
- Project Overview & Docs
- Tauri App Configuration
- Design Storage & Persistence
- render.js
- CI Test Workflow
- Package Manifest & Scripts
- App Menu & Shortcuts
- Release Script
- Tauri Capabilities & Permissions
- Auto-Update Logic
- Tauri Rust Bridge
- App Identity
- App Icon / Logo

## God Nodes (most connected - your core abstractions)
1. `geom()` - 26 edges
2. `initPalette()` - 17 edges
3. `drawCells()` - 15 edges
4. `openDesign()` - 12 edges
5. `initBoardDialog()` - 12 edges
6. `draw()` - 11 edges
7. `gallery()` - 11 edges
8. `paint()` - 10 edges
9. `instant()` - 10 edges
10. `exportDesign()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `render()` --indirect_call--> `edit()`  [INFERRED]
  src/board.js → scripts/release.mjs
- `Where data lives (app-data folder)` --conceptually_related_to--> `My Designs gallery (#gallery-dlg)`  [INFERRED]
  README.md → src/index.html
- `Beadboard` --shares_data_with--> `Photo underlay & opacity toggle`  [INFERRED]
  README.md → src/index.html
- `Beadboard` --conceptually_related_to--> `App shell (#app)`  [INFERRED]
  README.md → src/index.html
- `Beadboard` --shares_data_with--> `New/edit design dialog (#board-dlg)`  [INFERRED]
  README.md → src/index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Design Editing Workflow** — src_index_board_dialog, src_index_toolbar, src_index_editor_canvas, src_index_palette_panel, src_index_iso_canvas [INFERRED 0.85]
- **Release & Auto-Update Pipeline** — readme_release_process, readme_github_actions, readme_signing_key, readme_auto_update [INFERRED 0.85]

## Communities (19 total, 5 thin omitted)

### Community 0 - "UI Controller & Canvas Events"
Cohesion: 0.06
Nodes (59): actions, applyAt(), applyTheme(), boardDialog, cancelStroke(), changed(), check(), closeDialogs() (+51 more)

### Community 1 - "initPalette"
Cohesion: 0.23
Nodes (18): averageBox(), parseColor(), removeColor(), rgbToHex(), initPalette(), drawPick(), open(), render() (+10 more)

### Community 2 - "Release CI Workflow"
Cohesion: 0.05
Nodes (45): needs, runs-on, steps, strategy, outputs, runs-on, steps, GH_TOKEN (+37 more)

### Community 3 - "core.js"
Cohesion: 0.09
Nodes (38): clamp(), clearColor(), counts(), each(), fill(), hexRow(), hexToRgb(), label() (+30 more)

### Community 4 - "Project Overview & Docs"
Cohesion: 0.07
Nodes (31): Automatic update checking, Backup file designs/<id>.bak, Beadboard, src/core.js logic tests, Where data lives (app-data folder), Design file designs/<id>.json, Develop workflow (npm install/dev/test), Download / Releases (+23 more)

### Community 5 - "Tauri App Configuration"
Cohesion: 0.09
Nodes (22): app, security, windows, withGlobalTauri, build, frontendDist, bundle, active (+14 more)

### Community 6 - "Design Storage & Persistence"
Cohesion: 0.17
Nodes (13): ensureDirs(), getDesign(), KINDS, listDesigns(), loadBackup(), loadPalette(), MIME, native (+5 more)

### Community 7 - "render.js"
Cohesion: 0.13
Nodes (33): clampView(), paint(), initBoardDialog(), applyPreset(), card(), preview(), readFields(), render() (+25 more)

### Community 8 - "CI Test Workflow"
Cohesion: 0.14
Nodes (13): jobs, test, name, on, pull_request, push, branches, run (+5 more)

### Community 9 - "Package Manifest & Scripts"
Cohesion: 0.15
Nodes (13): devDependencies, @tauri-apps/cli@^2, name, private, scripts, build, dev, release (+5 more)

### Community 10 - "App Menu & Shortcuts"
Cohesion: 0.23
Nodes (12): about(), actions, appMenu(), buildMenu(), fallbackMenu(), fullSpec(), handles, MAC (+4 more)

### Community 11 - "Release Script"
Cohesion: 0.29
Nodes (3): die(), edit(), [v, notes]

### Community 12 - "Tauri Capabilities & Permissions"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 13 - "Auto-Update Logic"
Cohesion: 0.33
Nodes (8): initUpdater(), check(), download(), failed(), offer(), restart(), openReleases(), WINDOWS

## Knowledge Gaps
- **13 isolated node(s):** `beadboard`, `App Icon: Bead Heart on Pegboard`, `app.js (main script)`, `Photo underlay & opacity toggle`, `Color-pick canvas & loupe (#pick-canvas)` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 140 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `render()` connect `render.js` to `Release Script`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `initPalette()` (e.g. with `open()` and `render()`) actually correct?**
  _`initPalette()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `beadboard`, `App Icon: Bead Heart on Pegboard`, `app.js (main script)` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Controller & Canvas Events` be split into smaller, more focused modules?**
  _Cohesion score 0.05970149253731343 - nodes in this community are weakly interconnected._
- **Why does `initBoardDialog()` connect `render.js` to `UI Controller & Canvas Events`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `Release CI Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.04927536231884058 - nodes in this community are weakly interconnected._
- **Why does `edit()` connect `Release Script` to `render.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._