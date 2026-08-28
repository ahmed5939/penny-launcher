# Endurance Automation

An optional Penny add-on for running Fortnite Save the World Storm Shield
Endurance with the currently selected account.

## What it does

- Starts an Endurance session for the selected zone.
- Verifies each Fortnite screen with bundled reference images and retries
  clicks until the destination screen appears.
- Detects blocked/crashed sessions, recovers post-run reward screens and can
  repeat the run.
- Keeps its settings in Penny's per-add-on data directory.

## Install and use

Open **Add-ons**, search if you need to, review this README and the source,
then select **Install**. The add-on appears under **Installed**, where
**Open** takes you to its controls. If Penny DB is unreachable, this package
still appears because it ships with Penny.

Automation controls your game window. Test calibration with supervision before
leaving a run unattended.

## Source

This package is plain CommonJS. `main.js` is its entry point and is intentionally
small: it registers the add-on with Penny and opens the Endurance controls. The
current automation implementation is maintained in Penny's public repository.
