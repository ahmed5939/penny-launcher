# Penny plugins

Penny API v4 plugins run in **separate sandboxed Chromium renderers**, with no
Node/Electron access, direct network, filesystem, or launcher credentials.
All launcher operations pass through a permission-checked host bridge.

- [Developer guide and migration](./DEVELOPING.md)
- [UI, security, and release design guide](./DESIGN.md)
- [Typed SDK](./sdk/index.d.ts)
- [Selected-account quest example](./examples/scoped-quests/)

Create and validate a plugin without running its code:

```sh
npm run plugin:create -- my-plugin
npm run plugin:validate -- plugins/local/my-plugin
```

In Penny, open **Add-ons → Import folder**, select the generated directory,
review its access and README, and approve. Packages in `marketplace/` remain
inert until reviewed and installed. Generated folders are inert too.

Use the add-on card to run actions, edit settings, cancel jobs, read diagnostics,
disable or reload a plugin, or roll back its last code update. Changes to any
package file require another review before the changed code executes.

**Safe mode** stops all plugins and persists across restarts. You can also start
Penny with `--disable-plugins`. Saved plugin data survives removal.

Legacy main-process CommonJS plugins are listed for migration and never executed.
There is no unrestricted compatibility fallback.
