# Developing Penny plugins — API v5

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
  "apiVersion": 5,
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
| `inventory:read` | Read inventory DTOs for a currently selected account |
| `inventory:recycle` | Request permanent recycling of specific items with a Penny-owned confirmation |
| `epic-launcher:close` | Force-close only Epic Games Launcher on Windows |
| `system:read` | Read OS release, architecture, memory totals and uptime |
| `displays:read` | Read monitor sizes and scaling, without screenshots or hardware identifiers |
| `power:read` | Read battery versus external-power status |
| `fortnite:profiles` | Read declared, filtered game profiles for selected accounts |
| `fortnite:commands` | Request declared MCP changes with one-time Penny confirmation |
| `eos:locker:read` | Read equipped EOS locker slots for selected accounts |
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

There is no arbitrary authenticated URL/request API, credential API, script injection,
or custom privileged window API. New account operations should be explicit,
validated host methods. The quest reader returns only quest DTOs, accepts only a
current account id, checks scope again after the service response, and permits
one read per 10 seconds. Already dispatched reads are not aborted at the service
layer; their results are discarded if the plugin stops or scope changes.

## Context API

All host operations are asynchronous. Await them and handle failures.

| Member | Contract |
| --- | --- |
| `apiVersion`, `manifest` | API version 5 and the approved manifest |
| `accounts.list()` | Promise of `{ accountId, displayName, customDisplayName }[]` |
| `accounts.getScoped()` | Promise of `{ primary, members }` with sanitized accounts |
| `accounts.quests(accountId)` | Promise of `{ accountId, quests, rerolls, errorMessage? }`; read-only |
| `inventory.read(accountId)` | Promise of `{ accountId, items }`; current scope only, 10-second cooldown |
| `inventory.recycle(accountId, itemIds)` | Promise of `{ accountId, recycled, skipped, cancelled }`; 1–50 unique ids, 30-second cooldown |
| `epicLauncher.close()` | Promise of `{ closed: true }`; Windows only, 10-second cooldown; rejects on command failure |
| `desktop.system()` | Promise of `{ platform, release, architecture, totalMemoryBytes, availableMemoryBytes, uptimeSeconds }` |
| `desktop.displays()` | Promise of up to 16 `{ index, primary, width, height, workAreaWidth, workAreaHeight, scaleFactor }` records |
| `desktop.power()` | Promise of `{ onBattery }` |
| `mcp.operations()` | Discover supported operations, profiles, effects, required permissions, and payload schemas |
| `mcp.queryProfile(accountId, profileId)` | Read a filtered game profile; requires declared profile and `QueryProfile` |
| `mcp.request(accountId, { operation, profileId, body })` | Validated operation; a game profile for reads, an applied/cancelled receipt for commands |
| `eos.locker(accountId)` | Filtered active EOS loadouts and equipped slots, authenticated by Penny |
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

## Safe host operations (v5)

API v4 packages continue to run. Declare `apiVersion: 5` for the new operations.
The [inventory review example](./examples/inventory-review/) demonstrates an
account-scoped workflow with host confirmation. New permissions appear in the
existing package review and require approval when added by an update.

`inventory.read` returns the same inventory item DTOs used by Penny, never a raw
profile or access token. `inventory.recycle` takes one selected account and at
most 50 unique item ids. Penny fetches the inventory and presents its own native
confirmation with the plugin, account, and exact item details. Cancel is the
default, and review expires after 60 seconds. Requests are serialized across
plugins. Missing, favorited, and equipped items are skipped. After confirmation,
Penny reads the inventory again and skips items whose DTO changed. Only the
approved, unchanged ids are sent in one authenticated recycle batch.

Run recycling inside `jobs.run` and return immediately from the UI action so the
10-second action timeout does not interrupt human review. A cancelled confirmation
returns `cancelled: true`. Authentication/service failures reject. `recycled`
counts items in a successful service request; it is not a post-write verification.
An already dispatched service request cannot be undone by cancellation.

The new inventory operations bind to the exact plugin runtime and account-selection
generation. Stopping/reloading the plugin, removing its permission, or changing
selection (even away and back) prevents later dispatch and discards pending
results. The confirmation also closes when that context becomes invalid. A scope
change after an external request is sent cannot cancel its external effects.
The game can still change an item after the final inventory read; these checks
cannot provide an atomic server-side transaction.

`epicLauncher.close` grants a specific system effect: force-closing the Windows
image `EpicGamesLauncher.exe`. It accepts no arguments, exposes no process list,
and cannot target a PID, another image, process tree, shell command, or elevated
operation. The host uses a fixed system executable with a five-second timeout.
The install permission authorizes repeated calls, so a plugin may use a timer
for suppression. Calls fail on other platforms or if the command fails, including
when no matching process exists. Stopping a plugin stops its future timer calls;
an already dispatched close cannot be undone.

This extension enables inventory tools and reviewed recycling, plus Epic launcher
suppression. It does not enable unattended recycling: a future automatic policy
must be configured and enforced by Penny. Transparent Autoresponder still needs
a dedicated host implementation with constrained rules, explicit user control,
and reliable restoration of system changes. Plugins have no certificate-store,
elevation, raw filesystem, arbitrary network, or interception API.

For future extensions, add a named operation with a dedicated permission, strict
input/output DTOs, account/resource scope, rate and concurrency limits, lifecycle
checks immediately before side effects, and tests for denied access and races.
Keep credentials and privileged implementation inside Penny. Capability labels
alone never authorize access.

## Read-only desktop access (v5)

Declare `apiVersion: 5` and only the permissions your add-on needs. API v4
packages remain supported. These methods work on Windows and the other desktop
platforms supported by Penny. Each requires its own reviewed permission and
allows one call per second per plugin; each rejects arguments and stopped runtimes.

- `desktop.system()` (`system:read`) provides basic OS and memory information
  for compatibility messages or resource-aware scheduling. It excludes usernames,
  hostnames, environment variables, CPU identifiers, paths, and process lists.
- `desktop.displays()` (`displays:read`) provides sizes in device-independent
  pixels and display scaling for UI decisions. Display indexes are temporary
  positions in the returned list, not stable identifiers. No names, serial numbers,
  screenshot pixels, window contents, or monitor settings controls are exposed.
- `desktop.power()` (`power:read`) reports whether the computer is on battery,
  so background jobs can reduce work. It does not expose idle/lock activity or
  allow sleep, shutdown, or changes to power settings.

Example: with `power:read`, use `const { onBattery } = await context.desktop.power()`
and skip optional background work when `onBattery` is true. These permissions do
not authorize clipboard, keyboard, registry, filesystem, shell, or elevation access.

## Fortnite data and commands (v5)

See the [Fortnite API guide](./FORTNITE.md) for the declaration format, operation
catalog, raw-game-data filtering rules, input schemas, limits, and examples.
The [account showcase example](./examples/account-showcase/) reads progression,
cosmetics and EOS locker data without any mutation permission.

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
and `apiVersion: 5`, declare the permissions you use, and replace Node/Electron
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
