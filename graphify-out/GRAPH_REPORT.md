# Graph Report - jess-gift  (2026-11-07)

## Corpus Check
- Corpus is ~18,378 words - fits in a single context window. You may not need a graph.

## Summary
- 368 nodes · 693 edges · 20 communities (14 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.84)
- Token cost: 108,889 input · 0 output

## Community Hubs (Navigation)
- UI Controller & Canvas Events
- Mosaic Grid Core Logic
- Release CI Workflow
- Design Export & Rendering
- Project Overview & Docs
- Tauri App Configuration
- Design Storage & Persistence
- Board Dialog & Presets
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
- `Beadboard` --shares_data_with--> `Photo underlay & opacity toggle`  [INFERRED]
  README.md → src/index.html
- `Where data lives (app-data folder)` --conceptually_related_to--> `My Designs gallery (#gallery-dlg)`  [INFERRED]
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

## Communities (20 total, 6 thin omitted)

### Community 0 - "UI Controller & Canvas Events"
Cohesion: 0.06
Nodes (59): actions, applyAt(), applyTheme(), boardDialog, cancelStroke(), changed(), check(), closeDialogs() (+51 more)

### Community 1 - "Mosaic Grid Core Logic"
Cohesion: 0.09
Nodes (41): averageBox(), boardCenter(), clamp(), clearColor(), counts(), dims(), each(), emptyCells() (+33 more)

### Community 2 - "Release CI Workflow"
Cohesion: 0.05
Nodes (45): needs, runs-on, steps, strategy, outputs, runs-on, steps, GH_TOKEN (+37 more)

### Community 3 - "Design Export & Rendering"
Cohesion: 0.14
Nodes (35): clampView(), paint(), hexToRgb(), labels(), luminance(), maxHeight(), stackable(), top() (+27 more)

### Community 4 - "Project Overview & Docs"
Cohesion: 0.07
Nodes (31): Automatic update checking, Backup file designs/<id>.bak, Beadboard, src/core.js logic tests, Where data lives (app-data folder), Design file designs/<id>.json, Develop workflow (npm install/dev/test), Download / Releases (+23 more)

### Community 5 - "Tauri App Configuration"
Cohesion: 0.09
Nodes (22): app, security, windows, withGlobalTauri, build, frontendDist, bundle, active (+14 more)

### Community 6 - "Design Storage & Persistence"
Cohesion: 0.17
Nodes (13): ensureDirs(), getDesign(), KINDS, listDesigns(), loadBackup(), loadPalette(), MIME, native (+5 more)

### Community 7 - "Board Dialog & Presets"
Cohesion: 0.24
Nodes (13): initBoardDialog(), applyPreset(), card(), preview(), readFields(), render(), syncFields(), SAMPLE (+5 more)

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
Cohesion: 0.47
Nodes (4): initUpdater(), check(), offer(), openReleases()

## Knowledge Gaps
- **13 isolated node(s):** `beadboard`, `macOS install warning`, `Windows install warning`, `src/core.js logic tests`, `GitHub Actions build/publish` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 140 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `render()` connect `Board Dialog & Presets` to `Release Script`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `initPalette()` (e.g. with `open()` and `render()`) actually correct?**
  _`initPalette()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `beadboard`, `macOS install warning`, `Windows install warning` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Controller & Canvas Events` be split into smaller, more focused modules?**
  _Cohesion score 0.06057945566286216 - nodes in this community are weakly interconnected._
- **Why does `initBoardDialog()` connect `Board Dialog & Presets` to `UI Controller & Canvas Events`, `Design Export & Rendering`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `Mosaic Grid Core Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.09042553191489362 - nodes in this community are weakly interconnected._
- **Why does `edit()` connect `Release Script` to `Board Dialog & Presets`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._