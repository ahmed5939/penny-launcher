# Penny Launcher

[![CI](https://github.com/ahmed5939/penny-launcher/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmed5939/penny-launcher/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/ahmed5939/penny-launcher)](https://github.com/ahmed5939/penny-launcher/releases)

> **NOTE:** Currently in development.

A fast Windows desktop application to manage things on Fortnite STW.

Penny Launcher is a fork of [Aerial Launcher](https://github.com/Ciensprog/Aerial-Launcher) by **Ciensprog** (itself based on Potato Launcher), focused on **performance** and **new features**. All credit for the original application goes to Ciensprog and contributors. Licensed under GPL-3.0.

<!-- TODO: add a screenshot of Penny Launcher here (app-preview.jpg) once captured from the running app. -->

> [!IMPORTANT]
>
> - No developer of this application is associated with Epic Games.
> - **_Since this project is Open-Source, be careful if you download an installer from sources other than this repository; other sources may contain malicious code._**

## Table of Contents

- [Penny Launcher](#penny-launcher)
  - [Installation](#installation)
    - [Good To Know](#good-to-know)
      - [Migrating data from Aerial Launcher](#migrating-data-from-aerial-launcher)
      - [Update Application](#update-application)
  - [Features](#features)
  - [Development](#development)
  - [Credits](#credits)
  - [🤝 Contributing](#-contributing)

## Installation

Download the latest installer from the [Releases page](https://github.com/ahmed5939/penny-launcher/releases), or build it yourself from source (see [Development](#development)).

### Good To Know

Since this application is not code signed, when you try to install it you will see a confirmation dialog from Windows. This only happens the first time you install.

Settings are saved to `C:\Users\YOUR_USER\AppData\Roaming\penny-launcher-data`. Device-auth credentials in `accounts.json` (or `dev-accounts.json` while developing) are encrypted at rest with Electron `safeStorage` (Windows DPAPI / the OS keychain) and stored with an `enc:v1:` prefix. Plaintext files, including copies imported from Aerial Launcher, are encrypted the next time the launcher starts.

If you cloned this repository while `undefined/penny-launcher-data/dev-accounts.json` was still tracked, revoke that device auth in [Epic Games password & security settings](https://www.epicgames.com/account/password). The leaked entry used display name **LITileSTWHero**.

#### Migrating data from Aerial Launcher

Penny Launcher uses its own data folder (`penny-launcher-data`) so it won't collide with an existing Aerial Launcher install. To bring your data across:

> Remember to replace YOUR_USER with your Windows username.

1. Copy the files from `C:\Users\YOUR_USER\AppData\Roaming\aerial-launcher-data`.
1. Paste them into `C:\Users\YOUR_USER\AppData\Roaming\penny-launcher-data`.
1. Restart the launcher and your data should be loaded.

#### Update Application

When a new version is available, you will see a notification in the home section.

## Features

> Note: new features are still in development.

- Manage multiple Fortnite STW accounts (add via Authorization Code, Device Auth, or Exchange Code).
- Custom game path and custom display names per account.
- Launch the game with the selected account.
- Generate Exchange Codes.
- Access the [Penny DB](https://pennydb.net) profile of the selected account.
- Automation: daily quests, mission scheduling, auto-llamas, and more.

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

## 🤝 Contributing

1. Create a new branch `git checkout -b new-feature`.
1. Stage your changes with `git add .`
1. Commit your changes `git commit -m "my new feature"`
1. Push your commit `git push origin new-feature`
1. Open a Pull Request.
