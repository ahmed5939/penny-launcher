# Developing Penny plugins — API v4

## Quick start

1. Run `npm run plugin:create -- my-plugin`. An optional second argument chooses
   the parent directory. Existing directories are never overwritten.
2. Edit `plugins/local/my-plugin/main.js` and `plugin.json`. The generated
   `penny.d.ts` supplies completion and types through JSDoc; no plugin build is needed.
3. Run `npm run plugin:validate -- plugins/local/my-plugin`. This uses the same
   package inspector as Penny, then parses JavaScript syntax without executing it.
4. In **Add-ons**, choose **Import folder**, review permissions and README, then
   approve. The starter displays a settings form and a notification action.
5. Edit and import again to update. If you edit the installed folder, choose
   **Reload**, then **Review access** to approve its new contents.

See [DESIGN.md](./DESIGN.md), the [typed SDK](./sdk/index.d.ts), and the
[selected-account example](./examples/scoped-quests/).

## Manifest and package

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "A brief description of the user's task.",
  "version": "1.0.0",
  "author": "Your name",
  "runtime": "sandbox",
  "apiVersion": 4,
  "permissions": ["ui", "notifications"],
  "capabilities": ["notifications"],
  "entry": "main.js",
  "readme": "README.md",
  "repository": "https://github.com/owner/project"
}
```

`id` uses 1–64 lowercase letters, digits or hyphens, excluding Windows reserved
names. Names are limited to 100 characters. File paths must be relative, without
traversal, colons or backslashes. Repository links must be HTTPS without embedded
credentials. Unknown permissions/capabilities and invalid metadata are rejected.

Packages allow at most 500 regular files, 1,000 total filesystem entries, 12 levels
of nesting, and 10 MiB total. The entry may be at most 1 MiB and the manifest at
most 64 KiB. Symlinks and special files are rejected. All package contents,
including documentation, contribute to its SHA-256 review fingerprint.

An entry is browser-compatible JavaScript exporting `module.exports = { activate }`.
`activate(context)` may be async and return `{ open?, deactivate? }`. This CommonJS
export convention does **not** provide `require`, `process`, Node, or Electron.
Bundle any browser-compatible dependencies into the entry yourself if needed.

## Isolation and enforced permissions

Each plugin gets a worker inside a hidden sandboxed renderer and a unique in-memory session. Plugin code has no DOM or WebRTC constructors; the host page only relays messages. Blob workers inherit the restrictive host CSP.
Node integration is disabled, context isolation is enabled, browser permissions
are denied, new windows/navigation/downloads are blocked, and CSP plus request
filtering prohibit direct network and file access. The trusted preload exposes
only the plugin bridge, not Penny's renderer APIs. Every host request checks the
exact sender and main frame, validates payloads, and enforces the approved
package's permissions. Penny refuses plugin execution under `--no-sandbox`.

| Permission | Operations |
| --- | --- |
| `accounts:read` | Account names/ids, current scope, account change events |
| `quests:read` | Read active quests for an account in the current scope; internal authentication |
| `settings:read` | Read game path, watched process name, user agent; settings events |
| `storage` | Per-plugin JSON storage operations |
| `navigation` | Navigate to an existing Penny route |
| `notifications` | Desktop notifications prefixed with plugin name |
| `external-links` | Open HTTPS links in the system browser |
| `ui` | Register declarative panels, actions and settings; read saved form values |

Logging, job status, the plugin's own manifest and lifecycle messaging need no
permission. Capabilities (`background`, `changes-app-behavior`, `accounts`,
`notifications`, `network`, `filesystem`, `opens-windows`) are behavior disclosures,
not grants. Declaring `network` or `filesystem` does not unlock raw access.

There is no general authenticated request API, credential API, script injection,
or custom privileged window API. New account operations should be explicit,
validated host methods. The quest reader returns only quest DTOs, accepts only a
current account id, checks scope again after the service response, and permits
one read per 10 seconds. Already dispatched reads are not aborted at the service
layer; their results are discarded if the plugin stops or scope changes.

## Context API

All host operations are asynchronous. Await them and handle failures.

| Member | Contract |
| --- | --- |
| `apiVersion`, `manifest` | API version 4 and the approved manifest |
| `accounts.list()` | Promise of `{ accountId, displayName, customDisplayName }[]` |
| `accounts.getScoped()` | Promise of `{ primary, members }` with sanitized accounts |
| `accounts.quests(accountId)` | Promise of `{ accountId, quests, rerolls, errorMessage? }`; read-only |
| `settings.get()` | Promise of `{ gamePath, customProcess, userAgent }` |
| `storage.get(key, fallback?)` / `set(key, value)` / `delete(key)` / `all()` | JSON storage; atomic queued writes, detached reads, explicit errors |
| `events.on(name, listener)` | Local subscription; returns unsubscribe |
| `openRoute(route)` | Navigate to an existing local route |
| `openExternal(url)` | Open a credential-free HTTPS URL; 5 seconds between opens |
| `notifications.show(title, body)` | Promise of support/success boolean; 100/1000 character limits, 5 seconds between notifications |
| `log(message)` | Bounded, redacted diagnostic entry shown on the plugin card |
| `lifecycle.signal` | Aborted during graceful shutdown |
| `lifecycle.add(cleanup)` | Registers cleanup; returns unregister |
| `timers.every(callback, ms)` | Non-overlapping async timer; 1000–2147483647 ms, returns cancel |
| `ui.register({ panels, actions, settings })` | Replaces this plugin's contributions; see below |
| `ui.getSettings()` | Promise of current typed form values |
| `jobs.run(id, label, task)` | Runs `task(signal)`, records status, and supports cancellation |

Events: `accounts-changed`, `account-scope-changed` (raw ids), `settings-changed`,
and `plugin-settings-changed` (saved form values). Account/settings events require
the corresponding read permission. Cleanup and timers run inside the sandbox;
forced process termination may skip cleanup. Always design data writes accordingly.

Storage is limited to 1 MiB total and keys of 1–256 characters. Individual bridge
requests are limited to 128,000 serialized characters, 100 calls/second, and 16
concurrent host operations. Use smaller records instead of large requests. Invalid
existing JSON is preserved and reported. Saved form values use the reserved
`ui-settings` storage key; do not overwrite it yourself.

## Reusable UI

```js
async function activate(context) {
  await context.ui.register({
    panels: [{ id: 'intro', title: 'My tool', body: 'Plain text instructions.' }],
    settings: [{ id: 'enabled', label: 'Enable reminders', type: 'boolean', default: false }],
    actions: [{ id: 'run', label: 'Run tool', run: async () => {
      const values = await context.ui.getSettings()
      await context.log(`Reminders enabled: ${values.enabled}`)
    } }]
  })
}
module.exports = { activate }
```

Penny renders plain text, accessible controls and buttons using its own components.
No plugin HTML, CSS, React code or event handlers execute in Penny's renderer.
Limits: 10 panels, 10 actions, 20 settings; unique ids within each group, 100-character
labels/titles, 4,000-character panel bodies, 2,000-character text settings. Settings
can be `text` or `boolean`; default values and submitted values must match their type.

## Jobs, timeouts, and diagnostics

Activation and actions must finish within 10 seconds. A heartbeat detects hung
renderers independently of plugin code. Shutdown has a 1.5-second grace period,
then destroys the sandbox. Put long work in `jobs.run` and return promptly from
Open/actions. Check the job's signal between steps. Cancelling a job aborts its
signal; if it is still running after 3 seconds, Penny stops the whole plugin.

The plugin card shows job status, recent logs (up to 100 entries), permissions,
and the latest runtime failure. Errors sent from the host to the sandbox omit
internal service details. SDK listener/timer errors are logged. A crash or timeout
stops that plugin and leaves it in an error state; it does not automatically restart.

## Review, update, and rollback

Every import and catalog install/update starts with an inert snapshot. The review
shows requested permissions, newly added access, README and fingerprint. Approval
is tied to the exact snapshot, expires after 10 minutes, and cannot be replayed.
Changing an installed file requires review again. Existing installations are not
automatically grandfathered into permission grants.

Updates keep one prior code version. Failed activation restores the previous code
and grants; **Roll back code** swaps to the previously approved backup. Rollback
shares plugin data and does not undo writes or external side effects. Disabled
plugins stay disabled when updated. Package replacement rolls back caught errors;
it is not a power-loss transaction, and a machine crash during file moves can
require recovering the folder from `plugin-backups`.

Runtime data directories under Penny's data directory:

| Folder | Purpose |
| --- | --- |
| `plugins/<id>` | Installed source |
| `plugin-data/<id>` | Persistent JSON data; retained after removal |
| `plugin-control` | Approved fingerprints, enabled state and safe mode |
| `plugin-backups/<id>` | Previous code version |
| `plugin-staging` | Temporary reviewed snapshots; discarded after restart |

Safe mode persists and stops all plugins. `--disable-plugins` forces safe mode for
that launch. Turning off safe mode resumes only approved, enabled plugins.

## Migrating API v1–v3

Legacy plugins are never executed in the main process. Set `runtime: "sandbox"`
and `apiVersion: 4`, declare the permissions you use, and replace Node/Electron
operations with the context API. Account getters, navigation, notifications and
logging now return promises. Replace filesystem access with `storage`; replace
BrowserWindows with UI contributions; remove `getMainWindow`, `storageDirectory`,
and direct launcher internals. No unrestricted fallback is provided.

The bundled Endurance plugin is migrated: it needs only `navigation` and opens
Penny's existing Endurance page. Its actual automation remains launcher-owned.

## Publishing

Validate the package, include author, version, description, README and a public
HTTPS source link, then submit it under `plugins/marketplace/<id>`. Test the
release checklist in [DESIGN.md](./DESIGN.md). Marketplace presence is not a claim
that a package is signed or independently audited; users still review access.
