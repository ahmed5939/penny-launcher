# Penny client resource audit

## Fixes implemented after the audit

- Overlay settings register the shortcut without creating a window. First use creates it; toggling it off destroys it. Disabling during loading and retrying after failure are covered by tests.
- The WebGL viewer renders on demand, including texture loads and camera damping, and suspends frames while hidden. Scene teardown now releases icon textures and the shadow target.
- Main-process item data expires after 60 seconds without requests. Concurrent requests share one load. Renderer data expires after 60 seconds without consumers or while hidden, reloads when needed, and ignores late responses after leaving.
- Custom-process monitoring checks every ten seconds while the game is absent and every two seconds while present. Status IPC is sent initially and on change.
- Runtime logging retains at most two 2 MB files for newly written logs, limits pending writes to 100, and suppresses consecutive duplicate messages for a minute. Oversized legacy current logs are discarded on rotation.

The main shell remains available in the tray to preserve background bridges. Selection/display changes can still reconstruct the 3D scene; this patch removes its continuous idle rendering and retained textures. Actual Windows resource savings still require a packaged-app measurement. The findings below describe the original audit snapshot.

Date: 2026-09-06. Static inspection of the current working tree; no builds or dev servers run. Existing outpost edits and an asset recovery job were present during inspection. Sizes are snapshots and may change as that job finishes.

## What can actually be measured here

Penny is not running on this machine. RAM, CPU, GPU memory, startup latency, installed size, and network traffic for the Windows client remain **unmeasured**. Other Electron processes belong to Vesktop; their resource use is not Penny's.

| Local directory | Disk usage reported by `du -sh` | Meaning |
| --- | ---: | --- |
| `node_modules` | 1.1 GB | Development dependencies and runtime dependencies combined; not the installed client size |
| `src` | 6.9 MB | Source, translations, and source assets; not runtime RAM |
| `assets` | 14 MB | Assets at inspection time; recovery work is ongoing |
| `plugins` | 36 KB | Explicitly included as an extra packaged resource |
| `.vite` | 2.2 MB | Existing intermediate output; not a complete/current release measurement |

No `out`, `dist`, or `release` directory was found by the size check. The source-budget check passed, but it only caps individual TS/TSX files at 250,000 bytes and rejects embedded base64 images. It does not enforce RAM, CPU, installer, or bundle budgets.

## Architecture and feature costs

The client uses Electron 44.0.0 as declared in package.json, React 18, TanStack Router, Zustand, and Vite/Electron Forge. It includes account management, game launching, mission data, inventory/locker tools, automation, friends/party services, a quest overlay, and an optional 3D outpost viewer. This is a substantial desktop tool, not just a launch button.

Electron supplies Chromium and Node. The main process, UI renderer, graphics, and supporting processes all contribute to total resource use. Counting only the main process would understate it. A thin client goal must cover the entire process tree and GPU allocations.

Three.js handles the 3D viewer; sharp and a utility process handle locker image generation. fnbr/stanza support game/social operations. Dependency presence alone does not prove idle CPU usage: the important questions are when a feature loads, whether it remains resident, and whether it keeps doing work.

## Highest priority findings

### 1. A hidden overlay is created at startup on Windows

`src/config/constants/overlay.ts` defaults `enabled` to true. `src/kernel/main.ts:394` calls `OverlayWindow.start()` at readiness. `src/kernel/startup/windows/overlay.ts:189` creates a separate BrowserWindow and loads its renderer even though `show` is false. Disabling the setting destroys it, but startup initially uses the default settings.

**Impact:** extra window/renderer resources before the user opens the overlay. Hiding the overlay stops refresh polling, but leaves the window resident.

**Recommended change:** load saved settings first, register the shortcut independently, and create the window on first use. Consider releasing it after prolonged inactivity. Preserve enabled users' shortcut behavior.

### 2. The 3D viewer continuously renders a stationary scene

`src/routes/stw-operations/outpost/-blueprint-3d.tsx:1684` updates controls, renders, and requests another animation frame indefinitely while mounted. Antialiasing, soft shadows, and a pixel ratio up to 2 add graphics cost. The effect also depends on `selectedTrap` and display toggles, so those changes tear down and reconstruct the scene.

**Impact:** avoidable CPU/GPU work while viewing a still outpost, plus scene reconstruction spikes. This is feature-specific, not evidence of home-screen GPU use.

**Recommended change:** render on camera movement, resize, data changes, and interaction; continue frames only while damping is settling. Offer a low graphics setting with lower pixel ratio and disabled shadows. Update selection without recreating the renderer. The canvas fallback already uses a request-draw pattern.

### 3. The full item database stays in two processes after first use

`src/kernel/core/item-database.ts:160` holds a static payload cache, sends the payload over IPC, and `src/state/items/database.ts` retains the records in the renderer. Neither inspected store provides idle eviction. The seven-day disk cache age does not release the in-memory cache.

**Impact:** resident memory grows after visiting item-related pages and can remain elevated when returning home. Actual bytes depend on downloaded data and object overhead and are not known from source alone.

**Recommended change:** measure payload and heap sizes first, then return narrower page/search results or release the renderer copy after inactivity. Avoid making scrolling depend on an IPC request per item.

### 4. Process monitoring scans every two seconds when subscribed

`src/kernel/process-watcher.ts:33` calls ps-list every 2,000 ms while at least one listener exists: approximately 30 scans/minute. It prevents overlapping polls and stops when all listeners leave. `src/kernel/core/custom-process.ts` sends status over IPC on every poll, including unchanged status.

**Impact:** repeated system process enumeration and redundant IPC. This is conditional on custom-process monitoring being active, not an unconditional claim about every session.

**Recommended change:** emit only changed status; use slower checks while no game is running and faster checks around launches or active automation.

### 5. Minimizing preserves the UI and loaded stores

`src/kernel/main.ts` hides the main window to the tray on minimize. That keeps the renderer and its loaded data available for reopening. Deferring bootstrap stages improves startup scheduling but does not eliminate their eventual resident memory cost.

**Recommended change:** first pause optional work and evict bulky page data while hidden. Destroying/recreating the main renderer requires more design because account-scope synchronization and some background response listeners currently live there.

### 6. Runtime logging has no total size bound

`src/kernel/runtime-log.ts` limits each described message to 12,000 characters and serializes writes, but has no file rotation or queue limit.

**Impact:** repeated failures can grow disk usage; sustained errors can also accumulate pending writes. This is a growth risk, not a measured leak.

**Recommended change:** rotate a small fixed number of bounded log files and coalesce repeated errors.

## Existing efficiency measures worth keeping

- Feature pages such as outpost use lazy route components. Main-process features use dynamic imports.
- Startup work is staggered through idle callbacks and timers; translations load lazily.
- The global item-database bootstrap only registers a listener; feature pages request the data on demand.
- Main and overlay use separate dynamically loaded renderer entry paths.
- Overlay networking stops while hidden; the default visible refresh is every five minutes, with up to four players.
- Shared process polling prevents overlapping scans and releases its timer when unused.
- Virtual-list infrastructure limits mounted list rows where adopted.
- The home clock uses document visibility; a reusable visibility hook exists.
- The 3D viewer uses instancing and disposes controls, tracked resources, and its renderer on teardown.
- Locker image export uses a temporary utility process that is killed on completion, error, or timeout.
- Packaging discovers required main-process dependencies instead of copying every development dependency. Thus the 1.1 GB dependency folder is not a shipping-size estimate.

## Background network and account scaling

Bootstrap loads friends and home world info, and later requests PennyDB missions. Scheduled world-info and llama/daily-quest work also exists in main.ts. Automation maintains per-account checks, so work can scale with enabled account count. The overlay requests data only while shown. These paths have different cadences; there is no defensible single network-usage number without recording a representative session.

Measure requests and transferred bytes for zero, one, and several accounts, with automation both disabled and enabled. Avoid treating authentication/social connections required by active features as idle waste. Deduplicate equivalent refreshes and avoid refreshing invisible page data unless a background feature consumes it.

## Proposed acceptance targets, not measured results

For a first lean Electron milestone, use these provisional product goals on a specified Windows reference PC:

- Idle home, one account, automation off: total private working set at or below 200 MB.
- Hidden to tray, automation off: at or below 150 MB, with average CPU below 0.5% of total machine capacity over five minutes.
- No continuous 3D rendering when the scene is stationary, and no recurring GPU work attributable to hidden optional views.
- After repeatedly opening and closing heavy pages, memory should plateau; after idle eviction it should return near the warmed baseline.
- Establish installer and cold-start budgets from the first actual release measurement rather than inventing current sizes or timings.

These targets may require adjustment after profiling. A strict sub-100-MB whole-client requirement would warrant evaluating the runtime architecture after obtaining a minimal measured baseline; changing frameworks alone would not remove duplicated data or unnecessary work.

## Validation plan

Use a packaged Windows release the user starts manually. Record the complete Penny process tree, CPU over an interval, private working set/private bytes, GPU memory, disk reads/writes, and network bytes. Avoid conflating summed shared working sets with unique memory.

Compare cold start, warm idle home, minimized tray, first overlay open/close, item database first load, 3D scene still/moving/closed, locker export, and multiple active accounts. Repeat heavy-page navigation several times and allow collection/idle settling to distinguish temporary allocations from retained growth. Document machine specs, release revision, account count, enabled settings, and cache state.

Implementation order: lazy overlay creation; demand-driven 3D rendering; item-cache lifetime; adaptive process polling and changed-only IPC; bounded logs; then package/dependency trimming based on actual release contents. The initial audit changed no application code; the follow-up implementation is listed above.
