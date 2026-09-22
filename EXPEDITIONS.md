# Automatic expeditions

Implemented 20 September 2026 in this Launcher source checkout. No installed application, live bot, account inventory, or remote service was changed during development.

## Controls and reporting

Open STW Operations → Expeditions and select accounts. Enable automation, select one or more reward categories (or Select all expedition types), and optionally select a recycling rarity ceiling. Recycling defaults to Off. Keep Launcher running for scheduled work.

- Survivors: survivor scouting, lead survivors/managers, people runs.
- Heroes: hero rewards.
- Traps: trap runs and rare trap rewards.
- Weapons: weapon rewards.
- Materials: supply runs, crafting runs, building resources, ore mining, wood gathering.

Each account has reward history with rolling 24-hour, 7-day, 30-day, 365-day and all-time filters; sent/successful/unsuccessful counts; received quantities; recycled quantities; recycling gains; errors; pagination; and JSON export. History refreshes every ten seconds. Quantity reporting uses Epic's confirmed expeditionRewards notification, including rewards merged into existing stacks. Older history remains visible but cannot supply quantities it never recorded. The former 250-event retention cap is removed. History is local to this Launcher and does not import the Discord bot's ledger or manual/in-game collections.

## Recycling boundary

Only confirmed reward GUIDs that were absent before collection and match the refreshed campaign inventory are eligible. Supported types are Hero, Worker (survivors), Defender and Schematic. The rarity must be known and at or below Common/Uncommon/Rare/Epic. Legendary, Mythic, unknown rarity, favorites, squad members, loadout members, and existing inventory stacks are protected. Quantities must match. World weapons/traps and material stacks are tracked and retained: this implementation uses the verified campaign RecycleItemBatch operation, not world-item disassembly.

Collections are saved before optional recycling. A recycling or inventory-verification failure remains attached to a confirmed collection. Recycling gains are positive resource differences after a confirmed recycle response and inventory verification. No destructive retry is performed.

## Team selection and scheduling

Uses the live bot's hero power lookup and expedition duration/criteria data, with original data attribution retained in expedition-data.json. All 72 offers in that catalog are classified. Unknown future offer durations/criteria or unknown hero power are skipped rather than guessed. Teams respect unlocked vehicle slots, occupied squads, loadout heroes, actual hero power and distinct special-slot requirements/multipliers. A bounded search over the strongest twelve available heroes maximizes chance up to 100%, then minimizes hero use/excess power; the minimum is 80%. Sends the complete validated team once, confirms the expedition is running, and refreshes before selecting another team. Running and claimable expeditions share the six-slot limit.

Checks due accounts every minute. Normal cadence is hourly, or two minutes after the earliest return within a five-to-sixty-minute window. Errors retry in thirty minutes. Per-account in-flight protection and serialized settings writes prevent overlapping Launcher cycles and stale settings overwrites. Settings are rechecked during a run. This is not a distributed lock with the Discord bot; simultaneous automation on both clients is not coordinated.

## Audit and validation

Compared against the read-only live Penny bot at 57.128.159.57, /home/python/penny, main commit 063d600bbee69973a7c5ed5f7e7013deb9de429f, on 2026-09-20T02:00:24Z. Service was active/running with two dirty paths and a listener on port 80. Recent logs included an account-level RefreshExpeditions profile error; service health is not proof of successful account processing.

Launcher baseline: be0f0224e779d12ae16d6587d07018f690829f3e, codex/defender-helper. Existing Defender/Collection Book changes were preserved. Bot source snapshots are in the Penny project's audit/expeditions-20260920/bot directory.

Validation: 17 focused Vitest cases cover catalog coverage, reward quantities, recycling exclusions/resource gains, vehicle/team restrictions, collection confirmation, recycling failure, and concurrent settings changes. Focused ESLint and TypeScript checks are run without launching Electron, logging in, collecting rewards, or recycling live items. Live end-to-end validation and installation are separate stages.
