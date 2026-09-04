# Penny Launcher plugins

> Full developer guide: [DEVELOPING.md](./DEVELOPING.md)

A plugin is a plain CommonJS folder — no build step, no bundler. Marketplace
packages are kept under `marketplace/` as readable source and are inert until
the user clicks **Install**. Installation copies the chosen package to
`%APPDATA%\penny-launcher-data\plugins`, the only directory Penny executes.

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
  "capabilities": ["background", "changes-app-behavior"],
  "entry": "main.js",
  "readme": "README.md",
  "repository": "https://github.com/owner/repository"
}
```

`main.js` exports `activate(context)`, called once after the app is ready:

```js
function activate(context) {
  // context.storageDirectory — per-plugin folder under the launcher's data
  //                            directory; persist anything here.
  // context.storage          — async JSON key/value store (get/set/delete/all).
  // context.getMainWindow()  — the launcher's BrowserWindow (or null).
  // context.openRoute(path)  — opens a launcher page owned by the add-on.
  // context.accounts         — list() and getScoped(); sanitized accounts,
  //                            never tokens or secrets.
  // context.events.on(...)   — 'accounts-changed', 'account-scope-changed',
  //                            'settings-changed'; returns unsubscribe.
  // context.settings.get()   — stable subset: gamePath, customProcess,
  //                            userAgent.
  // context.log(message)     — line in Penny's runtime log, tagged plugin:<id>.
  // Full reference: DEVELOPING.md.

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

Use `capabilities` to tell users when an add-on continues working in the
background or changes Penny's normal behavior. These labels are informational;
they do not grant or restrict permissions.

Every marketplace package should include a README and a public source link so
people can understand, audit and reuse the code before installing it.
