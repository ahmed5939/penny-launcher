# 6th Perks

Native Save the World page (`/stw-operations/sixth-perks`) and its planner
(`/stw-operations/sixth-perks/completion`), integrated on 9 October 2026 from
the *Penny 6th Perks — native API v6 integration* handover package.

## What changed in the integration

- `catalog.json`, `planner-data.json`, `model.ts`, `planner.ts` and `types.ts`
  are the handover's, unchanged except: `parseItems` moved to `parse.ts` so
  the main process can parse a profile without bundling the 1.4 MB catalog,
  and `WeaponResult` omits `Weapon['options']` (the intersection made
  `options` a `PerkOption[] & OptionResult[]`, which did not typecheck).
- `src/kernel/core/sixth-perks.ts` is the handover's handler. It is
  registered as `sixth-perks:query` with `secureIpcHandle(…, { mainFrameOnly: true })`,
  and failed reads now go to the runtime log.
- The handover's views were rebuilt from the page kit (`UX-STANDARD.md`).
  They had used a raw `<select>`, palette colours and bare `<h2>`s, which
  `ux-standard.test.ts` rejects. Same behaviour, same filters. Two additions:
  the "Missing N" figures filter the list, and a catalog weapon's fixed
  starting perk is marked on its card.
- The scan lives in `src/state/stw-operations/sixth-perks.ts` (zustand,
  memory only) rather than in module variables in `-page.tsx`, so a scan
  started on one page finishes on the other. A rescan keeps the last result
  on screen. A reply that lands after a newer scan, or after the Collection
  Book setting changed, is dropped.
- The 27 handover tests were ported to vitest
  (`src/features/sixth-perks/{model,planner}.test.ts`,
  `src/kernel/core/sixth-perks.test.ts`). Store and page render tests were
  added beside them.

## Data

The perk catalog is extracted from Fortnite 42.20 definitions. Fixed-start
and rarity-cost evidence was checked against 42.30 assets using a 42.20
mapping (recorded in `planner-data.json → evidence`). These are dated
definitions, not a live hotfix feed. Update against newer authoritative data
without discarding recorded historical IDs.

FortniteDB's "Increases impact by 25%. Stun duration increased by 1s." rows
are an erroneous description of the six-second stun perk
(`alteration:aid_g_weapon_stun_v2`) and stay removed. The five remaining
website additions are historical Vindertech headshot rolls. The raw website
evidence was not copied into the repo; it is in the handover package's
`evidence/` folder.

## Not verified

- No scan has been run against a live account: ownership matching, the
  Collection Book read and the account-switch latch are only covered by
  tests.
- The page is read-only. Nothing crafts, upgrades, re-perks, unslots or
  recycles, and nothing should be added without a separate decision.
