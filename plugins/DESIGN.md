# Penny add-on design guide

## One clear task

Use a short name and a description of the user's outcome. Explain selected-account
scope, background behavior, notifications, data retention and any side effects.
Request only permissions you use; capabilities describe behavior and do not grant
access. Never claim a sandboxed plugin has arbitrary desktop access.

## Fit into Penny

Prefer `openRoute` for an existing launcher page. Otherwise register plain-text
panels, named actions and typed settings with `ui.register`. Penny supplies the
visual styling, keyboard controls and accessible labels. Plugins cannot inject
HTML/CSS or scripts into the launcher's renderer.

Use sentence case, concrete action labels, short explanations, one primary task,
and visible status. State which account is affected. Render empty, loading,
success and error states; do not use color alone. Preserve values after recoverable
errors and provide a clear next action. Avoid repetitive notification popups.

## Account operations

Read the current scope at action time. Never cache a startup account selection
for later work. Authenticated operations are explicit host methods and never
expose tokens. The quest reader is read-only. New write operations should show
the affected account and concrete changes before the user approves them; do not
introduce a generic authenticated request endpoint.

## Background work

Start long tasks with `jobs.run` and return promptly from the action. Check its
AbortSignal between steps. The card shows status and cancellation. The host will
stop the plugin if it ignores cancellation. Use `timers.every` for non-overlapping
polls with sensible intervals, and register cleanup immediately after acquiring
resources. Shutdown cleanup is best effort; process termination may skip it.

## Security model

Plugin code runs in a worker inside a separate Chromium renderer with sandboxing, isolated context,
no Node integration, an ephemeral session and no direct network. The trusted host
validates each message and its sender. Only reviewed permissions enable launcher
operations. Review applies to a fingerprint of every package file, not just a
name or declared version. There is no legacy main-process execution fallback.

These choices follow [Electron's security guide](https://www.electronjs.org/docs/latest/tutorial/security)
and [sandbox documentation](https://www.electronjs.org/docs/latest/tutorial/sandbox).
Sandboxing reduces exposure; it is not a guarantee against Chromium vulnerabilities
or unlimited memory consumption. Keep Electron updated. Permissions such as
external links and notifications still have real user-visible effects.

## Data and errors

Await storage writes and show actionable failures. Never automatically replace
corrupt user data. Do not persist credentials or include them in log messages.
Saved data survives uninstall and is shared across code versions; migrations
should preserve compatibility with the last version so rollback remains useful.

## Release checklist

- Fresh import: inspect permissions, README, and correct plugin identity.
- Reject/cancel review: no plugin code starts.
- Repeated actions: no duplicate work, visible progress and failures.
- Missing accounts and scope changes: no stale account results.
- Cancel a job and disable during work: resources stop and state stays usable.
- Update with extra access: review clearly shows the new permissions.
- Failed activation and explicit rollback: previous code remains usable.
- Restart while disabled or in safe mode: plugin does not start unexpectedly.
- Edit an installed file: changed code requires another review.
- Keyboard navigation, narrow windows, text wrapping, and clear control labels.
- Validate source with `npm run plugin:validate -- path/to/plugin`.
