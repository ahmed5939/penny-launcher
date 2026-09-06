# Endurance Automation

Optional Storm Shield Endurance automation for the currently selected account.
Install and enable this add-on to access its controls under **Add-ons**. Endurance
is not part of the standard STW navigation.

## Access

Runs in the API v4 sandbox and requests `navigation` to open its controls.
Penny supplies the native game-control implementation: it starts Fortnite,
reads game screens and logs, sends mouse/keyboard input, claims rewards and
can repeat runs. The sandbox itself has no direct desktop or account-token access.
Automation starts only when you press Start in the controls.

Disabling, removing, reloading or stopping the add-on cancels its automation and
calibration. Safe mode blocks access. Saved automation settings are retained.

## Install and use

In **Add-ons → Discover**, choose **Review & install**, read the requested access
and this README, and approve. Press **Open** on its installed card to reach the
controls. Select an account and test calibration before starting a run.
F8 stops automation. Existing installations should review this catalog update
to use the new add-on route.

## Source

`main.js` opens the add-on controls. The native automation support is maintained
in Penny's host and only accepts requests while this add-on is running.
The public source is linked in the manifest and on the marketplace card.
