# Endurance Automation

An optional Penny add-on for running Fortnite Save the World Storm Shield
Endurance with the currently selected account.

## What it does

- Starts an Endurance session for the selected zone.
- Uses log-driven waits and calibrated screen positions.
- Returns to the lobby, claims rewards and can repeat the run.
- Keeps its settings in Penny's per-add-on data directory.

## Install and use

Open **Add-ons**, choose **Discover**, review this README and the source, then
select **Install**. The add-on appears under **Installed**, where **Open** takes
you to its controls.

Automation controls your game window. Test calibration with supervision before
leaving a run unattended.

## Source

This package is plain CommonJS. `main.js` is its entry point and is intentionally
small: it registers the add-on with Penny and opens the Endurance controls. The
current automation implementation is maintained in Penny's public repository.
