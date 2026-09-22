# Daily quest automations

Installed in the local Penny Launcher on 20 September 2026.

## Controls

- **Automate → Auto update daily quests** enables quest updates independently for each selected account.
- **Automate → Auto daily reroll** enables rerolling and automatically enables quest updates for that account. Updates cannot be disabled while reroll remains enabled; this is enforced in the backend as well as the UI.
- Turning reroll off leaves quest updates enabled. Turn updates off separately if desired.
- Existing enabled reroll configurations automatically gain enabled quest updates. Accounts without either automation configured remain off.

Quest updates run after **00:01 UTC**; rerolls run after **00:04 UTC**, only once today's quest update has succeeded. Penny must remain running. Opening after reset catches up. The older hidden all-account updater now delegates to these per-account controls, preventing bypasses and duplicate updates.

The worker refreshes quests with ClientQuestLogin and requires an error-free profileChanges response. Failed updates retry after fifteen minutes and block rerolls until successful. Successful update dates survive restarts. The two operations have separate status messages and retry state.

Rerolls preserve selected quest templates, completed/claimed quests, quests over 50% complete, internal quest triggers, and quests with missing/invalid progress data. One eligible quest is submitted only when Epic reports an available reroll. Submission intent is saved first; uncertain results cannot trigger a second automatic attempt that day. Epic's dailyQuestReroll notification is required to report success.

Settings and status are stored in auto-daily-reroll.json in Penny's existing data directory. Discord preferences are separate. Account credentials were not modified or copied.

## Validation and installation

50 focused tests passed, including standalone updates, UTC reset ordering, update-to-reroll dependency enforcement, failed update retry, restart deduplication, unavailable quest catalogue, and navigation. TypeScript and focused lint checks passed. Installed main/preload and renderer bundles were built against the running version; unrelated archive files were verified unchanged. Both installed pages were opened for UI verification without enabling a real account or submitting a test reroll.

Source: C:\Users\James\Documents\ChatGPT\Fortnite - v40\penny-defender-helper.

Local deployment scripts: scripts/build-installed-daily-reroll.cjs and scripts/install-daily-reroll-local.ps1. They stage the feature against the current installed archive, verify pre-install hashes, preserve timestamped backups, and restart Penny. Installation metadata and backup paths are recorded in .local-deploy/daily-reroll-*/installed.json.
