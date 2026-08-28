# Penny Launcher

[![CI](https://github.com/ahmed5939/penny-launcher/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmed5939/penny-launcher/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/ahmed5939/penny-launcher)](https://github.com/ahmed5939/penny-launcher/releases)

<p align="center">
  <img src="src/assets/brand/penny-head.png" alt="Penny" width="96" height="96" />
</p>

Windows desktop app for managing Fortnite Save the World accounts: launch the official game, watch mission alerts, and run STW tools from one window.

Penny is a GPL-3.0 fork of [Aerial Launcher](https://github.com/Ciensprog/Aerial-Launcher) by **Ciensprog** (itself based on Potato Launcher). Maintained by **Ahmed** ([ahmed5939](https://github.com/ahmed5939)). All credit for the original application goes to Ciensprog and contributors.

> Currently in development. Not affiliated with Epic Games. **Not code signed** — Windows SmartScreen will warn on first install. Only download installers from [this repository's Releases](https://github.com/ahmed5939/penny-launcher/releases).

## Installation

Download the latest installer from the [Releases page](https://github.com/ahmed5939/penny-launcher/releases), or build it yourself from source (see [Development](#development)).

### Good To Know

The first install shows a Windows confirmation dialog because the app is not code signed. That only happens once.

Settings are saved to `C:\Users\YOUR_USER\AppData\Roaming\penny-launcher-data`. Device-auth credentials in `accounts.json` (or `dev-accounts.json` while developing) are encrypted at rest with Electron `safeStorage` (Windows DPAPI / the OS keychain) and stored with an `enc:v1:` prefix. Plaintext files, including copies imported from Aerial Launcher, are encrypted the next time the launcher starts.

#### Migrating data from Aerial Launcher

Penny Launcher uses its own data folder (`penny-launcher-data`) so it won't collide with an existing Aerial Launcher install. To bring your data across:

> Remember to replace YOUR_USER with your Windows username.

1. Copy the files from `C:\Users\YOUR_USER\AppData\Roaming\aerial-launcher-data`.
1. Paste them into `C:\Users\YOUR_USER\AppData\Roaming\penny-launcher-data`.
1. Restart the launcher and your data should be loaded.

Or use **Add account → Import from Aerial** on a PC that already has Aerial installed.

#### Update Application

When a new version is available, you will see a notification on the home screen.

## Features

> Note: new features are still in development.

- Manage multiple Fortnite STW accounts (add via Authorization Code, Device Auth, Exchange Code, or Aerial import).
- Custom game path and custom display names per account.
- Launch the official Fortnite binary with the selected account (home button or tray).
- Generate Exchange Codes.
- Edit the local Fortnite `GameUserSettings.ini` (resolution, display mode, VSync, frame rate limit, 3D resolution) from Settings. Penny copies the file before every write, and the copy can be restored from the same panel.
- Access the [Penny DB](https://pennydb.net) profile of the selected account.
- Automation: daily quests, mission scheduling, auto-llamas, and more.
- Discord Rich Presence from the launcher process only (in launcher / in Save the World / in Battle Royale). Nothing is injected into Fortnite.

## Development

Requires [Node.js](https://nodejs.org/) (LTS).

```bash
npm install        # install dependencies
npm start          # run the app in development
npm run make       # build a distributable
npm run lint       # lint the codebase
npm run typecheck  # typecheck the codebase
```

Releases are automated: pushing a `v*` tag (matching the version in `package.json`) builds the Windows installer on GitHub Actions and creates a draft GitHub release.

## Credits

- **Ciensprog** — original developer of [Aerial Launcher](https://github.com/Ciensprog/Aerial-Launcher), the project Penny Launcher is based on.
- The Aerial Launcher contributors and the wider Fortnite STW community.
- **Ahmed ([ahmed5939](https://github.com/ahmed5939))** — current Penny maintainer.

## Contributing

1. Create a new branch `git checkout -b new-feature`.
1. Stage your changes with `git add .`
1. Commit your changes `git commit -m "my new feature"`
1. Push your commit `git push origin new-feature`
1. Open a Pull Request.
