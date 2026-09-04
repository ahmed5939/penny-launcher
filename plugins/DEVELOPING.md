# Developing Penny Launcher plugins

This guide explains how the plugin (add-on) system works and how to write your
own plugin, from an empty folder to a marketplace package. For the short
overview, see [README.md](./README.md).

## How the system works

Penny plugins are **plain CommonJS folders** — no build step, no bundler, no
TypeScript compilation. The launcher never bundles plugin code into its own
Vite build; plugins stay as real files on disk so they can carry their own
windows, preload scripts, assets and helper scripts.

There are two directories involved:

| Directory | Purpose |
| --- | --- |
| `plugins/marketplace/` (in the repo; `resources/plugins/marketplace` when packaged) | The catalog. Packages here are **inert, readable source** — never executed. |
| `%APPDATA%\penny-launcher-data\plugins\` | The user directory. This is the **only** place Penny loads and runs plugins from. |

The flow, driven by `src/kernel/startup/plugins.ts` (`PluginManager`):

1. On startup, Penny scans every subfolder of the user plugin directory.
2. A folder is treated as a plugin if it contains a valid `plugin.json`
   (invalid or stray folders are skipped silently — they never break startup).
3. Penny `require()`s the entry file and calls its exported
   `activate(context)` once.
4. `activate()` may return a controller object (`open`, `deactivate`). The
   returned `open` function backs the **Open** button on the Add-ons page.
5. If `activate()` throws, the plugin still shows on the Add-ons page but with
   an **error** badge and the error message — the rest of the app keeps
   working.
6. On app shutdown, controllers' `deactivate()` hooks are called in reverse
   load order.

Clicking **Install** on a marketplace package simply copies its folder from
the catalog into the user directory and loads it. Duplicate ids and existing
destination folders are rejected; a failed install is rolled back.

## Folder contract

```
my-plugin/
├── plugin.json   ← manifest (required)
├── main.js       ← entry point (required, CommonJS)
├── README.md     ← documentation (strongly recommended)
└── …             ← anything else: windows, preload scripts, assets, scripts
```

### `plugin.json`

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "One-line description shown on the Add-ons page.",
  "version": "1.0.0",
  "author": "Your Name",
  "category": "Automation",
  "capabilities": ["background", "changes-app-behavior"],
  "entry": "main.js",
  "readme": "README.md",
  "repository": "https://github.com/owner/repository"
}
```

Field reference (see `src/types/plugins.ts` → `PluginManifest`):

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Lowercase letters, digits and hyphens only (`^[a-z0-9-]{1,64}$`). Must be unique — a second plugin with the same id is ignored. |
| `name` | yes | Display name on the Add-ons page. |
| `description` | no | One-liner shown in the plugin list and marketplace. |
| `version` | no | Shown in the UI. |
| `author` | no | Shown in the marketplace. |
| `category` | no | Marketplace grouping (e.g. `"Automation"`). |
| `capabilities` | no | User-visible effects. Add `"background"` if work continues without the user opening the add-on, and `"changes-app-behavior"` if it alters Penny's normal behavior. These labels are informational, not permissions. |
| `entry` | no | Entry file relative to the plugin folder. Defaults to `main.js`. |
| `readme` | no | Docs file relative to the plugin folder. Defaults to `README.md`. |
| `repository` | no | Public source link shown in the marketplace. |
| `apiVersion` | no | Minimum plugin API version you need (currently `2`). If the launcher is older than that, the plugin shows an "update Penny" error instead of half-working. Omit it if the v1 trio (`storageDirectory` / `getMainWindow` / `openRoute`) is enough. |

`entry` and `readme` must be **relative paths that stay inside the plugin
folder** — absolute paths or `../` escapes are rejected.

### The entry file

`main.js` must export an `activate(context)` function. It is called once,
after the Electron app is ready. It may be `async`.

```js
const path = require('node:path')
const fs = require('node:fs')

function activate(context) {
  // Runs once at startup (or right after the user installs the plugin).
  const settingsFile = path.join(context.storageDirectory, 'settings.json')

  return {
    // Optional. Backs the "Open" button on the Add-ons page.
    open: () => {
      // Show a window, start your automation, or jump to a launcher page:
      context.openRoute('/stw-operations/endurance')
    },

    // Optional. Called on app shutdown — stop timers, close windows, etc.
    deactivate: () => {},
  }
}

module.exports = { activate }
```

Everything about the return value is optional: a plugin that only wants to
run in the background can return nothing at all.

Every successfully activated add-on is shown as **Running** in Penny. If it
does ongoing work from `activate()`, declare the `"background"` capability;
if it changes Penny's normal behavior, also declare
`"changes-app-behavior"`. A tool whose `activate()` only returns an `open`
action does not need either label.

### The `context` object

The context is versioned (`context.apiVersion`, currently **2**). Everything
below is available today; declare `"apiVersion": 2` in your manifest if you
rely on anything beyond the first three rows.

| Member | Description |
| --- | --- |
| `context.storageDirectory` | A per-plugin folder under the launcher's data directory (`penny-launcher-data/plugin-data/<id>`), created for you before `activate()` runs. Persist settings, caches and state here — it survives reinstalls of the plugin folder. |
| `context.getMainWindow()` | The launcher's `BrowserWindow`, or `null` if it isn't open. |
| `context.openRoute(path)` | Navigates the launcher's UI to an in-app route (must start with `/`). Navigation goes through the renderer's router via IPC, so it works in packaged `file://` builds too. |
| `context.apiVersion` | The plugin API version this launcher provides. |
| `context.manifest` | Your own parsed `plugin.json`. |
| `context.log(message)` | Writes an `INFO` line to Penny's runtime log (`penny-runtime.log` in the Electron logs folder), tagged `plugin:<id>`. Use it instead of `console.log` — main-process stdout is invisible in packaged builds. |
| `context.accounts.list()` | All accounts, **sanitized**: `{ accountId, displayName, customDisplayName }`. Never tokens, device ids or secrets. |
| `context.accounts.getScoped()` | Who the app is currently about, as selected in the UI: `{ primary, members }` with the same sanitized shape (`primary` may be `null`). This is what "run for the current account" should mean in your plugin. |
| `context.events.on(event, listener)` | Subscribe to launcher change events; returns an unsubscribe function. Events: `'accounts-changed'` (an account was added, removed, loaded or imported — call `accounts.list()` for the new state), `'account-scope-changed'` (payload: `{ primary, members }` as raw account ids), `'settings-changed'` (re-read `settings.get()`). Listener errors are caught and logged, never fatal. |
| `context.storage` | Durable JSON key/value storage backed by `<storageDirectory>/storage.json`, with queued writes. All methods are async: `get(key, fallback?)`, `set(key, value)` (`undefined` deletes; the value must be JSON-serializable), `delete(key)`, `all()`. |
| `context.settings.get()` | Async; a **stable subset** of the launcher settings: `{ gamePath, customProcess, userAgent }`. These fields are a contract — unlike the raw `settings.json`, they won't be renamed out from under you. |

A worked example — an add-on that reacts to the current account:

```js
function activate(context) {
  const unsubscribe = context.events.on(
    'account-scope-changed',
    async () => {
      const { primary } = context.accounts.getScoped()

      if (!primary) return

      await context.storage.set('lastAccountId', primary.accountId)
      context.log(`scope moved to ${primary.displayName}`)
    }
  )

  return {
    open: async () => {
      const settings = await context.settings.get()
      // e.g. launch a helper against settings.gamePath for the scoped account
    },
    deactivate: () => unsubscribe(),
  }
}

module.exports = { activate }
```

## What plugins are allowed to do, and what they actually have

There is **no permission system and no sandbox**. Once installed, a plugin is
fully trusted code running in the Electron **main process** — the same
process the launcher itself runs in. "Allowed" is therefore social, not
technical: the marketplace rule is that **every package must ship a README
and a public source link** so people can read and audit the code before
installing it. Technically, a plugin can do anything the launcher can.

What a plugin *has* falls into three tiers:

### Tier 1 — the official API: the `context` object

This is the **entire** supported API surface — everything documented under
[The `context` object](#the-context-object): your storage directory and
JSON storage helper, the main window, route navigation, the runtime log,
the sanitized account list, the current account scope, launcher change
events, and the stable settings subset. These are contracts: they keep
working across launcher releases, and `context.apiVersion` / the manifest's
`apiVersion` field exist so both sides can tell when they don't match.

What the context deliberately does **not** hand you: auth tokens, device
secrets, or any game/Epic API client. Account data is always sanitized to
`{ accountId, displayName, customDisplayName }`. There is also no way to
call the launcher's internal services directly — its code is bundled into
`.vite/build/main.js`, so you cannot `require()` its modules
(`DataDirectory`, the MCP/Epic request layer, etc.) from a plugin. If your
plugin needs an authenticated Epic call, that currently means proposing a
context API for it upstream rather than extracting credentials.

### Tier 2 — full Node/Electron access

Because you run unsandboxed in the main process, you can:

- Create your own `BrowserWindow`s with your own HTML/preload scripts
  (ship them as files in your plugin folder and reference them with
  `path.join(__dirname, ...)`).
- Register your own IPC channels with `require('electron').ipcMain` to talk
  to **your own** windows. (You cannot add channels to the launcher's main
  window — its preload only exposes a fixed, launcher-owned set.)
- Use any Node built-in (`fs`, `child_process`, `net`, …) — read files,
  spawn helpers (e.g. PowerShell scripts shipped in your folder), make
  network requests.
- `require()` any of the **launcher's own dependencies by name** (e.g.
  `uiohook-napi`, `electron`). In packaged builds the loader puts the app's
  `node_modules` on the global resolution path before loading plugins, so
  this works the same as in development.

There is no `package.json`/`npm install` step for plugins — if you need a
library the launcher doesn't ship, vendor it into your plugin folder or ask
for it to be added to the launcher's dependencies.

### Tier 3 — the launcher's data files (internal, read at your own risk)

The launcher keeps its state as plain JSON files in its data directory
(`%APPDATA%\penny-launcher-data\`), right next to your `storageDirectory`:
`settings.json`, `automation.json`, `friends.json`, `taxi-service.json`,
`auto-llamas.json`, `urns.json`, `accounts.json`, `world-info/`, and so on.

A plugin *can* read these with `fs`, but treat them as **internals, not an
API**:

- Their schemas are private to the launcher and can change in any release
  without notice — prefer the stable `context.settings.get()` /
  `context.accounts.*` APIs wherever they cover your need.
- **Never write to them.** The launcher validates them against schemas and
  queues its own writes; a plugin writing concurrently can corrupt state or
  be silently overwritten.
- **Leave `accounts.json` alone.** The plugin API already gives you every
  account field you may see (`context.accounts.list()`); what it withholds
  is credentials, and that is deliberate. Credentials in `accounts.json`
  are encrypted at rest with Electron `safeStorage` (`enc:v1:` values) —
  a marketplace package that touches them will not be accepted.

If your plugin needs launcher data that isn't reasonably reachable this way,
the intended path is to propose a proper feature or context API in the main
repository — that's how the Endurance automation ended up as a built-in page
with the plugin reduced to an `openRoute()` shortcut.

### How plugins integrate with the launcher UI

The only supported hook into the launcher's own window is
`context.openRoute(path)` — jumping to a page that already exists in the
launcher (the endurance plugin's whole `open` action is
`context.openRoute('/stw-operations/endurance')`). You cannot inject
components, menu items, or scripts into the launcher's renderer; it doesn't
load plugin code. For any custom UI, open your own `BrowserWindow` with your
own HTML and preload.

## Where plugins keep data

Each plugin gets its own private folder, created before `activate()` runs
and passed in as `context.storageDirectory`:

```
%APPDATA%\penny-launcher-data\
├── plugins\<id>\        ← your code (replaced on reinstall/update)
└── plugin-data\<id>\    ← your storageDirectory (persists across reinstalls)
```

Persist everything there — settings, caches, logs, tokens your plugin
obtained itself. Read and write it with plain `fs`; the format is entirely
up to you (the built-in pages use JSON files, e.g. a `settings.json`).
Never write into your own plugin folder at runtime: it is what gets
replaced when the user reinstalls or updates the package, while
`plugin-data` survives.

## Error handling rules

- A folder without a readable, valid `plugin.json` is skipped silently.
- A manifest with an invalid `id` (must match `^[a-z0-9-]{1,64}$`) or a
  missing `name` is skipped.
- If the entry file is missing, doesn't export `activate()`, or `activate()`
  throws, the plugin is listed with status `error` and the message is shown
  on the Add-ons page. Startup is never blocked by a broken plugin.
- `open()` errors are caught and reported back to the UI as a failed action.

Design your plugin the same way: fail inside your own code without taking the
launcher down, and surface problems through your own UI or by throwing early
in `activate()` so the error badge explains what's wrong.

## Development workflow

1. Open **Add-ons** in Penny and use the "open plugins folder" action (or go
   to `%APPDATA%\penny-launcher-data\plugins` yourself).
2. Create `my-plugin/` there with a `plugin.json` and `main.js`.
3. Restart the launcher — plugins are scanned once at startup. Check the
   Add-ons page for your plugin (and its error badge, if any).
4. Iterate: edit files, restart, repeat. Use `context.storageDirectory` for
   anything you write at runtime, never your plugin folder itself.

When running the launcher from source (`npm start`), the same flow applies —
the user plugin directory under the dev data directory is what gets loaded;
the repo's `plugins/marketplace/` remains catalog-only.

## Publishing to the marketplace

1. Add your package as a folder under `plugins/marketplace/<your-id>/` in the
   repo.
2. Include `plugin.json` (with `author`, `category` and `repository` filled
   in), `main.js`, and a `README.md` that explains what the plugin does, how
   to use it, and where the source lives.
3. Open a pull request. Marketplace packages should be small and readable —
   see `plugins/marketplace/endurance/` for the reference example: its
   `main.js` is seven lines and just registers an **Open** action that routes
   to a launcher page.

## Minimal working example

`plugin.json`:

```json
{
  "id": "hello-window",
  "name": "Hello Window",
  "description": "Opens a tiny window from a plugin.",
  "version": "1.0.0"
}
```

`main.js`:

```js
const path = require('node:path')
const { BrowserWindow } = require('electron')

function activate(context) {
  let window = null

  return {
    open: () => {
      if (window && !window.isDestroyed()) {
        window.focus()
        return
      }

      window = new BrowserWindow({ width: 480, height: 320 })
      window.loadFile(path.join(__dirname, 'index.html'))
    },
    deactivate: () => {
      if (window && !window.isDestroyed()) {
        window.close()
      }
    },
  }
}

module.exports = { activate }
```

Add an `index.html` next to it, drop the folder into the user plugin
directory, restart Penny, and press **Open** on the Add-ons page.
