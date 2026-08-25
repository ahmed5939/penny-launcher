# Penny Launcher plugins

A plugin is a plain CommonJS folder — no build step, no bundler. The launcher
loads every folder in here (shipped with the app as `resources/plugins`) and
every folder in `%APPDATA%\penny-launcher-data\plugins` (user drop-ins), then
shows them on the **Plugins** page.

## Folder contract

```
my-plugin/
├── plugin.json   ← manifest (required)
├── main.js       ← entry (required, CommonJS)
└── …             ← anything else: windows, preload scripts, assets, scripts
```

`plugin.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "One-line description shown on the Plugins page.",
  "version": "1.0.0",
  "entry": "main.js"
}
```

`main.js` exports `activate(context)`, called once after the app is ready:

```js
function activate(context) {
  // context.storageDirectory — per-plugin folder under the launcher's data
  //                            directory; persist anything here.
  // context.getMainWindow()  — the launcher's BrowserWindow (or null).

  return {
    // Optional. Backs the "Open" button on the Plugins page.
    open: () => {
      /* show your window, start your thing */
    },
  }
}

module.exports = { activate }
```

Plugins run in the main process with full Electron/Node access, and can
require the launcher's dependencies (e.g. `uiohook-napi`) by name.
If `activate()` throws, the plugin shows on the Plugins page with an error
badge instead of breaking startup.

Built-in and user plugins share one id namespace; a built-in plugin wins over
a user plugin with the same id.
