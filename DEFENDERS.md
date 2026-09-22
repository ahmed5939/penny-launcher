# Defender helper

Added under **Save the World → Defenders**. Uses the selected account and Penny's existing read-only campaign inventory IPC. No credentials, account snapshots or item mutation actions are bundled.

## Ranking

Epic/Legendary defenders with at least three compatible weapon perks are highlighted. Count weapon perks that can apply to one weapon: repeated perks count, but mutually exclusive melee subtype bonuses do not combine. Sort roll quality before rarity and level; provide a separate level sort. Health/shield/regen remain visible as survival perks. Unknown perks are flagged and left unscored.

Weapon recommendations use actual owned schematic alterations, preserve slot six independently of other legacy gameplay perks, and explain AOE, affliction, critical, reload and magazine interactions. One inactive headshot perk does not exclude an otherwise useful weapon. Priority is a qualitative fit heuristic, not simulated DPS. Role filters distinguish crowd damage, crowd control and body-hit damage. No automatic recycling or spending.

## Evidence and assumptions

`src/features/defenders/catalog.json` contains public definitions extracted from installed Fortnite 42.20 CL 58011042, using the existing Release-42.00 CUE4Parse mappings. Exact schematic IDs resolve through fresh CraftingRecipes_New entries to fresh weapon names/tags. The catalog contains no player records. Bows, launchers and Storm King weapons are not recommended without verified defender compatibility.

The user's observed mechanics are explicit assumptions: no headshots; no ammo or durability cost; ignored sixth-perk cooldowns; Dragon's Roar's innate 3-second affliction. The latter is identified by exact game name and is not inferred for other Dragon weapons. Legacy proc cooldowns outside slot six are marked for confirmation. Trigger counts, standing-still conditions, target immunities and on-kill conditions remain relevant. Exact proc damage and legacy conditional critical statistics are not numerically simulated.

This is an allocated-roll comparison. Slot activation at the defender's current level is not independently verified. Labels do not claim all listed perks are active. Unknown/new content remains visible rather than being guessed. Schematic ownership is not backpack weapon ownership.

## Rebuild catalog

Run `python scripts/build-defender-catalog.py <extraction-dir>` with fresh `all-weapons`, `all-schematics` (including `CraftingRecipes_New.json`), `weapon-perks`, and `defender-perks.json`. Inspect extraction failures before regenerating. Bump the catalog build when updating the source assets.

## Integration

Changes are isolated on `codex/defender-helper`, based on the repository's current HEAD `be0f022`. A targeted native-route adapter was installed into the existing 1.1.0-rb20260904x2015 build on 20 September 2026. It reuses the installed React, account selection, item database and UI components. Existing launcher code and plugins were preserved. The executable's embedded archive hash was updated without disabling integrity checks. Use the normal source/package workflow for future releases; the adapter is specific to this inspected build.

## Validation

37 focused tests pass (defender matching and navigation), TypeScript checking and scoped ESLint pass. Renderer production build succeeds. Browser preview checked against the local inventory snapshot, including the Assault 71c4589f Dragon's Roar/Argon matches and switching to an empty account. Private preview fixtures are excluded from the change. This does not replace live Electron integration testing or gameplay verification of player-reported mechanics.

Weapon suggestions offer best-perk-fit and highest-current-level ordering. Low-level schematics carry upgrade notes. Inventory parsing preserves original alteration slots separately from the existing filtered list, so missing slots cannot shift the sixth perk.

Weapons can have multiple roles and appear in each matching role filter. Afflicted-target knockback AOE receives both crowd-damage and crowd-control tags and additional fit value for stalling enemies. Its miniboss interaction is recorded as player-observed, specific to that perk.

Defenders carries the existing BETA navigation pill. Defender and weapon images display a power-level caption above the artwork, computed from ItemRatings; no tier overlay covers the artwork.
