# Penny Launcher plugins

A plugin is a plain CommonJS folder — no build step, no bundler. Marketplace
packages live under `marketplace/` as readable source and are inert until the
user clicks **Install**. Installation copies or extracts the package into
`%APPDATA%\penny-launcher-data\plugins`, the only directory Penny executes.

The in-app catalog is fetched from Penny DB so new listings can appear without
a launcher rebuild. If Penny DB is down, Penny shows the last cached catalog,
then the bundled packages in this folder. **Endurance Automation always
appears** because it ships with the app.

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
  "author": "Your name",
  "category": "Automation",
  "entry": "main.js",
  "readme": "README.md",
  "homepage": "https://example.com/my-plugin",
  "repository": "https://github.com/owner/repository"
}
```

`main.js` exports `activate(context)`, called once after the app is ready:

```js
function activate(context) {
  // context.storageDirectory — per-plugin folder under the launcher's data
  //                            directory; persist anything here.
  // context.getMainWindow()  — the launcher's BrowserWindow (or null).
  // context.openRoute(path)  — opens a launcher page owned by the add-on.
  //
  // context never includes account tokens. Do not log secrets.

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

Every marketplace package should include a README and a public source link so
people can understand, audit and reuse the code before installing it.

## Remote catalog (Penny DB)

Default URL: `https://pennydb.net/api/marketplace`

The launcher accepts this document, a `{ marketplace: [...] }` wrapper, or a
raw array. Upload `plugins/marketplace.json` (this repo) to that endpoint —
or serve the same JSON at any HTTPS URL and paste it under **Add-ons →
Catalog**. JSON Schema: `plugins/marketplace.schema.json`.

Minimal listing:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-28T00:00:00.000Z",
  "plugins": [
    {
      "id": "radar",
      "name": "Radar",
      "version": "1.0.0",
      "description": "One line for the Discover tab.",
      "author": "You",
      "category": "Tools",
      "homepage": "https://pennydb.net",
      "repository": "https://github.com/owner/radar",
      "readmeUrl": "https://raw.githubusercontent.com/owner/radar/main/README.md",
      "minLauncherVersion": "1.0.0",
      "screenshots": ["https://pennydb.net/images/radar.png"],
      "download": {
        "url": "https://pennydb.net/marketplace/radar-1.0.0.tgz",
        "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      }
    }
  ]
}
```

### Hosting on Penny DB

1. Publish HTTPS JSON at `/api/marketplace` (or `/marketplace.json`).
2. Host each remote package as an npm-style `.tgz` (`npm pack` from the
   plugin folder is fine). The archive must contain `plugin.json` and
   `main.js`; a leading `package/` prefix is stripped.
3. Put the SHA-256 of the **archive bytes** in `download.sha256`. Without a
   hash, Penny refuses to install unless the user enables **Allow unsigned
   remote add-ons**.
4. Optional: Ed25519-sign the 32-byte digest and put the signature in
   `download.signature`. Ship the matching public key in
   `src/config/constants/marketplace.ts` (`marketplacePublicKeys`).
5. To list Endurance from Penny DB as well, keep `"bundled": true`. The
   launcher still copies the folder that ships with the app unless a newer
   hashed archive is listed.
6. Screenshots must be HTTPS on `pennydb.net` or `raw.githubusercontent.com`
   (renderer CSP). Relative download URLs resolve against the catalog URL.

No Penny DB deploy is included in this change. Until that endpoint exists,
Discover shows the bundled catalog (Endurance) and any cached copy.

## Trust and loading

- **Bundled** packages are copied from `plugins/marketplace/` and loaded.
- **Local** folders dropped into the user plugins directory are loaded.
- **Remote** packages are downloaded over HTTPS only, extracted with
  zip-slip and symlink rejection, then hashed. A tree hash is recorded and
  checked again on startup. Unsigned remote packages are disabled by
  default; the Catalog tab has the override.
- `activate(context)` never receives account tokens. Penny's runtime log
  redacts token-like strings. Plugins still run in Electron main with Node —
  that is required for Endurance (uiohook / screen / input). This is
  admission control, not a sandbox. A malicious add-on can still read files
  on disk.

Disable skips `require()`. Uninstall removes the add-on folder and keeps
`plugin-data/<id>`. Update replaces the folder, then loads the new copy.
