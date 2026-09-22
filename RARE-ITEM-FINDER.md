# Rare Item Finder

Native Save the World page (`/stw-operations/rare-item-finder`), ported on
23 September 2026 from the API-v2 add-on **penny-legacy-finder 1.4.4**.

## What changed in the port

- The plugin's private adapter (which located `authentication`/`item-database`
  modules inside `.vite/build`) is gone. `src/kernel/core/rare-item-finder.ts`
  reads the four profiles in the main process through `Authentication` and the
  linked `AccountsManager` record, exactly like Backpack/Storage and the
  Collection Book. The renderer sends an account id only and receives
  classified, token-free results over `rare-item-finder:scan`.
- The plugin's own BrowserWindow, preload and `ipcMain` channel are replaced by
  a normal route (`src/features/rare-item-finder/view.tsx`). The v5 plugin
  sandbox cannot host this tool: its panels are plain text and its package
  limit (10 MiB) is below the 20 MB slot-rules file.
- Classification is unchanged: `model.ts` and `slot-audit.ts` are line-for-line
  ports of `lib/model.js` and `lib/slot-audit.js`, with the slot rules passed in
  as a parameter. The 34 classification tests were ported to vitest and pass;
  the adapter/service tests were replaced by `src/kernel/core/rare-item-finder.test.ts`.
- `rare-item-finder-assets/slot-rules.json` (20 MB) ships as a forge
  `extraResource`, like `endurance-assets`, and is loaded only while a scan
  runs. The smaller dictionaries live in `src/features/rare-item-finder/data/`.
- Live item-database records take priority for names/artwork/ratings; the
  bundled `item-metadata.json` snapshot is the fallback, as before.
- Still read-only: no favourite, recycle, conversion, transfer, unslot, upgrade
  or perk-changing path exists in UI, preload, IPC or main.

Account switching discards in-flight results; token refreshes and display-name
updates do not restart a scan. Each copy keeps its profile/location/GUID key,
so identical templates are never merged. A profile that fails to read is shown
as failed and the scan is reported incomplete rather than empty.

The original add-on README follows for behaviour and data history.

---

# Penny Rare Item Finder

Version 1.4.4 · Penny Launcher plugin API v2 · **Read-only release**

Find legacy weapon and trap items across one selected Penny account. The plugin opens its own Vault-style window with **AOE Weapons selected first**, plus the four original inventory sections:

- Inventory Schematics
- Collection Book Schematics
- Backpack Weapons & Traps
- Storage Weapons & Traps

Search by item name or perk, filter weapons/traps, switch between confirmed legacy items and items needing review, and inspect the perks on each individual copy. Cards show names, artwork where available, rarity, level/power, quantities and the existing favourite state. Large inventories use pages of 48 cards.

## Install

1. Extract `Penny-Rare-Item-Finder-Plugin-v1.4.4.zip`.
2. Copy the enclosed `penny-legacy-finder` folder into `%APPDATA%\penny-launcher-data\plugins\`. The final manifest path must be `%APPDATA%\penny-launcher-data\plugins\penny-legacy-finder\plugin.json`.
3. Next time you restart Penny, open **Add-ons → Penny Rare Item Finder → Open**.
4. Choose the account and use **Refresh scan**. Opening the plugin with a selected account starts a scan automatically.

No npm installation is required. The ZIP includes the runtime code and dictionaries. It does not include account data. This delivery does not install into or restart your live Launcher.

### Updating from an earlier version

Exit Penny completely, replace the existing `penny-legacy-finder` plugin folder with the folder from this ZIP, and reopen Penny. Reopening only the plugin window does not reload its cached main-process modules.

Version 1.0.1 fixes scans returning to “Ready to scan” when Penny republishes the same account scope during token/account updates. Repeated same-account events now preserve both in-progress scans and completed results. A genuinely new account still cancels the old scan, and an account supplied after the window opens now starts scanning automatically. Startup scans are owned by the main process, avoiding competing UI requests. All mutations remain disabled.

### AOE Weapons (new in 1.1.0)

The default category finds the specific **legacy Knockback AOE** perk: “Hitting an afflicted target causes a small Knockback AOE around them (5s cooldown).” Both known IDs are matched case-insensitively in either perk field:

- `Alteration:aid_g_weapon_ondmg_afflictedenemy_knockbackaoe`
- `Alteration:aid_g_weapon_ondmg_afflictedenemy_knockbackaoe_v2`

Weapon schematics and crafted weapons from the selected account are grouped under **Inventory:**, **Collection Book:**, **Backpack:** and **Storage:**. Each copy keeps its location and GUID, so separate copies are never merged. AOE badges and highlighted matching perks also appear in the four original categories. Traps and unrelated modern area-effect/explosion perks are excluded from this category.

Search and sorting work across all four locations. The original weapon/trap and legacy/review filters do not restrict the AOE category. Failed, unreadable or unfinished profiles remain clearly marked; a partial total is not presented as a complete account scan. If more than 48 matches are found, use the page controls; location headings state when their matches are on another page.

## This release cannot change items

All four sections are read-only. Favourite all is visibly disabled, the preload has no mutation method, IPC rejects favourite requests, and both the service and adapter reject mutation attempts. The only game operation implemented is `QueryProfile`.

Future favouriting, when enabled in a separate release, will apply **only to legacy schematics in Inventory Schematics (`campaign`)**. Collection book, backpack and storage are not favourite targets. There are no recycling, conversion, perk replacement, transfer, unslot or upgrade operations.

## Legacy rules, current slots and modded candidates (1.2.0)

The **Modded Weapons & Traps** category collects candidate schematics and crafted items across Inventory, Collection Book, Backpack and Storage, using the same location grouping as AOE Weapons. Pink card badges and highlighted mismatching perk rows explain exactly which slot is outside the extracted rules. AOE Weapons remains the default category. Original location tabs default to Legacy & modded candidates, with separate legacy, candidate, review and all-item filters.

A candidate has a known perk outside the exact item's slot allow-list, or more stored slots than the item's extracted loadout. Schematic IDs resolve through the extracted crafting links. All perk-rarity buckets are considered, including Common sixth perks. Repeated perks are allowed when each slot permits them; no universal duplicate-family ban is inferred. Empty slots keep their original positions. Locked missing perks do not count as a modification; missing unlocked perks need review.

Unknown templates, unresolved rules, unknown perks alone, malformed data and conflicting perk arrays remain review cases. Legacy or refund-marked items are not tested against modern slot legality: historical slot tables were not recovered, so legacy and mixed legacy/current rolls cannot be reliably adjudicated as modded with this snapshot. Matching an old perk identifies its definition, not proof that the roll was originally obtainable.

Bundled data:

- `data/legacy-perks.json`: 147 IDs, combining the 146 weapon/trap definitions extracted from game 42.10 with the API's additional Knockback AOE `_v2` ID. Defender definitions are excluded. The `_v2` ID also occurs in modern extraction; its earlier API/AOE recognition is deliberately retained for compatibility, not presented as historical roll evidence.
- `data/current-perks.json`: 301 readable weapon/trap descriptions (24 defender descriptions are separate) after merging extracted modern definitions and API descriptions and separating recognized legacy IDs.
- `data/slot-rules.json`: 4,136 exact item variants, 4,082 schematic links, slot allow-lists and unlock context. Fourteen variants remain unresolved. These do not become implicit matches.
- `data/item-names.json` and `data/item-metadata.json`: existing API/Vault display fallbacks and power tables.
- `data/provenance.json`: original API lineage, extraction build/mapping details and file hashes.

Source: the user-provided `perk-audit-42.10` extraction, build `42.10 CL 57819926`, decoded using 42.00 mappings. Server hotfixes, historical roll tables and exact-version runtime parity are not available. **Modded candidate means outside this current rules snapshot, not confirmed modification.** A match likewise does not prove authenticity. Raw perk IDs and findings are visible in the item details. These snapshots do not update automatically.

Rebuild the runtime dictionaries with `python tools/import-perk-audit.py PATH_TO_PERK_AUDIT_DIRECTORY`. The source extraction is read-only; no accounts or credentials are used in the build. This release updates only the plugin, not the standalone launcher installer.

## Compatibility and authentication

Target build inspected: Penny `1.1.0-rb20260904x2015`, plugin API **2**. The sandboxed API v4 is intentionally unsupported.

The v2 public plugin context has no inventory-read method. `lib/launcher-adapter.js` therefore isolates the private compatibility boundary: it loads the host's authentication and item-database exports from `.vite/build`, checks their interfaces, reuses Penny's account token refresh, and sends four explicit profile queries. Hashed filenames are discovered by a constrained module-name pattern; they are not hardcoded.

Profiles queried: `campaign`, `collection_book_schematics0`, `theater0`, `outpost0`. The plugin does not call Penny's database-backed account routes or require a Penny API account-record ID.

Account credentials files are never read by plugin code. Tokens remain inside the main-process adapter and are not saved by this plugin or passed to its renderer. The window uses a sandboxed preload, context isolation, disabled Node integration, restricted image origins, and sender-validated IPC. Closing the window or switching accounts cancels the current scan and ignores stale responses.

Private host interfaces can change between v2 builds. An incompatible host produces an explicit plugin error instead of attempting to read credential files. This is a personal v2 compatibility plugin, not a claim of acceptance by the newer marketplace.

## Validation

- `node --test tests/*.test.js`: classification, every bundled legacy and current perk, repeated slots, source/profile boundaries, missing metadata, partial failures, account changes and mutation rejection.
- `tests/ui-smoke.cjs`: Chromium tests for four sections, filters, mixed-perk details, paging, empty-account state, disabled mutations and compact layout.
- `tests/electron-smoke.cjs`: real Electron window/preload/IPC with the installed v2 authentication module evaluated against a fixture-only transport. Verifies all four profile routes and absence of tokens in renderer state.

The 1.0.1 regression test first reproduced same-account scan cancellation against 1.0.0, then passed with the fix. Electron coverage also sends repeated scope events during authentication and after Refresh, and checks account availability after window startup.

The integration harness uses synthetic profiles. **No live account scan or inventory mutation was performed during creation.** Item screenshots used for QA are examples, not the user's inventory. First use in Penny is the remaining live-account validation step.

Developer smoke tests need Playwright/Electron paths supplied through `PENNY_PLAYWRIGHT_MODULE`, `PENNY_CHROMIUM_PATH` and `PENNY_ELECTRON_PATH`; these development tools are not required by the plugin.

## Source notes

Legacy matching follows Penny API's `modules/profile.py` and `ext/weapons_traps_manager.py`; current descriptions come from the `dataT` dictionary loaded by API `main.py`. Artwork uses the same [PegLegResources image source](https://github.com/PegLegFN/PegLegResources) used by the inspected Vault implementation. Epic game assets belong to their respective owners.

## Historical exceptions (1.2.1)

The user-confirmed five-headshots damage bonus (`aid_g_ranged_headshotstreak_dmgbonus_v2`) in slot 6 on the original Vindertech ranged families is shown in blue as **Historical perk - no longer selectable**. This exception covers Pulsar, Blazer, Blaster, Burster, Disintegrator and Jolter variants and their schematic aliases. It does not extend to other slots, weapons, melee, traps or the Seeker bow.

This perk alone no longer triggers the modded category. Other mismatches on the same copy still do. Historical items remain visible in the default combined location filter and Needs review, with an explanatory badge. `data/historical-perks.json` records the user's confirmation as its evidence; it is an explicit historical override, not a recovered game roll table. Current allow-lists remain unchanged.

### Plasmatic Discharger Reload Speed (1.2.2)

All five modern Reload Speed strengths on the five Plasmatic Discharger tiers are recorded as user-confirmed historical perks. Their original slot positions have not yet been confirmed, so the display says **Historical perk - slot position unverified** and routes these findings to historical review rather than treating the perk alone as proof of a modded candidate. This is not a slot whitelist. Other mismatches and extra slots continue to flag candidates. The exception resolves schematic aliases and crafted copies and does not apply to another weapon or trap.

## Historical Weapons & Traps category (1.3.0)

A dedicated category groups recognised historical exceptions by Inventory, Collection Book, Backpack and Storage. It includes Discharger Reload Speed and the Vindertech five-headshots exception, with blue card/perk highlights. Unverified historical slot positions remain clearly labelled. Copies with additional unexplained violations stay in Modded Weapons & Traps instead; their historical perk notes are retained in the detail panel. Unknown perks and legacy items without a specific historical exception are not automatically included. AOE remains the default. Search, sorting, pagination and incomplete-scan indicators work as in the other account-wide categories.

### Shooting Star (1.3.1)

The user-confirmed +50% Magazine Size perk (`aid_att_magazinesize_t03`) in slot 4 is a historical exception for Shooting Star variants and their schematic aliases. It appears in Historical Weapons & Traps unless another unexplained violation is present. The exact strength and slot are taken from the supplied screenshot; other strengths and positions are not implicitly whitelisted.

### Third Rail verification (1.3.2)

The 42.10 dictionary currently allows +50% Magazine Size in slot 4 on all 14 Third Rail variants. A regression test confirms this passes current rules, so no retired-perk exception is applied. The Shooting Star historical fix is included.

## Defender perks and Legacy Hybrids (1.4.0)

All 24 exact defender IDs from the 42.10 extraction are bundled separately in `data/defender-perks.json`, with readable descriptions. A weapon or trap schematic containing one in either perk array is marked **Modded - Defender Perk**, including schematics in the Collection Book. This rule runs before legacy/refund, missing-loadout and conflicting-array handling, so these cannot hide a known defender perk. Unknown IDs that merely resemble defender names are not automatically confirmed. This explicit rule is scoped to schematics.

Any item containing both a recognised legacy perk and a recognised modern weapon/trap perk is highlighted **Legacy Hybrid**, across all four inventory locations. Modern perks on hybrids are highlighted in their detail list, and a Legacy hybrids only filter is available in the location tabs. Defender perks, unknown IDs and metadata-only names do not qualify as modern weapon perks. Hybrid is a descriptive flag, not proof of modification; it coexists with AOE and modded flags. The AOE default and all mutation restrictions remain unchanged.

This delivery is plugin-only; no standalone launcher installer has been rebuilt.

## Review classification fix (1.4.1)

Refund/legacy flags alone no longer prevent an item whose perks pass the current slot rules from being classified as normal. Exact resolved definitions with zero slots can omit their perk arrays. Ammo and crafting-material schematics are excluded. The observed Epic Crystal T5 Third Rail has a user-confirmed historical exception for +38% Magazine Size in slot 3; other slots and strengths are not inferred. Actual legacy perk definitions retain historical safeguards, and defender detection still takes priority.

Validated against sanitized read-only Plingindigo Inventory and Collection Book snapshots on 17 September 2026 and 41 automated tests. Inventory: 1,308 normal, 63 legacy, five historical, 17 outside-current-rule candidates. Collection Book: 616 normal, four legacy, six historical. In 1.4.1 the review total included historical items; this is corrected in 1.4.2. No account data or credentials are included in the plugin package.

## Confirmed classifications (1.4.2)

The user confirmed the 17 audited mismatches as modded. Exact item variants and ordered perk combinations are recorded without account identifiers, and matching copies display MODDED. Other mismatches remain candidates. Recognised historical items and confirmed modded items are excluded from Needs review. The captured Inventory and Collection Book now both have zero unresolved items. Validated with 43 automated tests.
