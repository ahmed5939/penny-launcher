# Fortnite plugin API (v5)

Penny provides a reviewed MCP gateway and an EOS locker reader. Plugins can build
account dashboards, inventory/collection explorers, quest tools, loadout managers,
and expedition tools. Authentication, service addresses and request transport stay
in Penny. API v4 packages remain supported.

## Declare the exact access

```json
{
  "id": "my-quest-tool",
  "name": "My Quest Tool",
  "runtime": "sandbox",
  "apiVersion": 5,
  "permissions": ["accounts:read", "fortnite:profiles", "fortnite:commands", "ui"],
  "fortnite": {
    "profiles": ["campaign"],
    "operations": ["QueryProfile", "SetPinnedQuests"]
  }
}
```

Installation/update review displays the profile and command declarations as well
as permissions. All are part of the approved package fingerprint. Changing them
requires another review. A plugin cannot supply a URL, authentication header,
target-account override, revision, service deployment, or arbitrary command.

`mcp.operations()` returns the host catalog: operation name, supported profiles,
description, permission, `confirmationRequired`, and a data-only `bodySchema` for
building forms. Array uniqueness and positional-array consistency are additionally
enforced by the host. Catalog visibility does not grant execution permission.

## Read game profiles

```js
const { primary } = await context.accounts.getScoped()
if (!primary) throw new Error('Select an account first.')
const profile = await context.mcp.queryProfile(primary.accountId, 'campaign')
const level = profile.stats.attributes.level
const items = Object.entries(profile.items)
```

Profiles: `campaign`, `athena`, `common_core`, `theater0`, `outpost0`,
`collection_book_people0`, `collection_book_schematics0`. A request requires both
the declared profile and declared `QueryProfile` operation, plus `fortnite:profiles`.
The equivalent `mcp.request(accountId, { operation: 'QueryProfile', profileId,
body: {} })` uses exactly the same policy.

The result retains game field names and item GUIDs:

```ts
{
  accountId, profileId, filtered: true, rvn?, commandRevision?,
  items: { [itemId]: { templateId, quantity, attributes } },
  stats: { attributes }
}
```

This is **filtered game data, not an unrestricted raw response**. Positive field
schemas preserve supported progression/research stats, quest progress, survivor
and hero attributes, item quantities, cosmetic variants, and other reviewed game
fields. Unknown fields are omitted at every nested boundary, including inside
arrays. Unknown item-template families are omitted too. New fields require a
host schema update; absence of a field does not mean its game value is zero.

The projection excludes account emails, linked identities, authentication/device
secrets, account-security flags, purchase receipts/history, gift counterparties,
session identifiers, arbitrary notifications and secondary-profile responses.
`common_core` exposes supported game items such as currency balances but **no
profile stats**. Supported fields are defined in
[`plugin-profile-data.ts`](../src/kernel/startup/plugin-profile-data.ts).

## Execute reviewed commands

Use `jobs.run` and return promptly from UI actions. Confirmation may take longer
than the ten-second action deadline:

```js
void context.jobs.run('pin', 'Pin quests', async (signal) => {
  const { primary } = await context.accounts.getScoped()
  if (!primary || signal.aborted) return
  const result = await context.mcp.request(primary.accountId, {
    operation: 'SetPinnedQuests', profileId: 'campaign',
    body: { pinnedQuestIds: ['quest-item-id'] }
  })
  await context.log(result.cancelled ? 'Cancelled.' : 'Pinned quests updated.')
})
```

Every command below uses `campaign` and requires `fortnite:commands`, an exact
manifest declaration, and a Penny-owned **Allow once** dialog. The dialog names
the plugin, account, command, effect, and exact validated payload. Cancel is the
default; review expires after 60 seconds. The plugin cannot approve it itself.

| Operation | Required body fields |
| --- | --- |
| `ClientQuestLogin` | `{}` |
| `SetPinnedQuests` | `pinnedQuestIds` |
| `FortRerollDailyQuest` | `questId` (consumes a reroll) |
| `ClaimQuestReward` | `questId`, `selectedRewardIndex: 0` |
| `ClaimMissionAlertRewards` | `{}` |
| `ClaimDifficultyIncreaseRewards` | `{}` |
| `RefreshExpeditions` | `{}` |
| `ClaimCollectedResources` | `collectorsToClaim` |
| `CollectExpedition` | `expeditionId`, `expeditionTemplate` |
| `StartExpedition` | `expeditionId`, `squadId`, `itemIds`, `slotIndices` |
| `AbandonExpedition` | `expeditionId` (may lose progress/rewards) |
| `AssignWorkerToSquadBatch` | `characterIds`, `squadIds`, `slotIndices` |
| `AssignHeroToLoadout` | `heroId`, `loadoutId`, `slotName` |
| `AssignDefenderToLoadout` | `defenderId`, `loadoutId`, `slotName` |
| `AssignWeaponToDefender` | `defenderId`, `weaponSchematicId` |
| `SetActiveHeroLoadout` | `selectedLoadout` |
| `ClearHeroLoadout` | `loadoutId` |
| `AssignTeamPerkToLoadout` | `loadoutId`, `teamPerkId` |
| `AssignGadgetToLoadout` | `loadoutId`, `gadgetId`, `slotIndex` (0 or 1) |

Extra body fields are rejected. IDs use 1–160 letters, digits, underscores, dots,
colons or hyphens; ID arrays allow at most 50 entries. Hero slots are
`CommanderSlot` or `FollowerSlot1`–`FollowerSlot5`. Positional arrays must have
equal lengths and cannot duplicate a destination slot. Empty command bodies are
allowed only where the policy specifies them. See the runtime catalog and
[`plugin-fortnite-policy.ts`](../src/kernel/startup/plugin-fortnite-policy.ts).

Commands return `{ accountId, profileId, operation, cancelled, applied }`. They
do not return arbitrary MCP change notifications. Read the profile afterward if
needed. `applied: true` means the service request succeeded, not that Penny made
a separate read to verify it. An error may leave the external outcome unknown;
refresh before retrying. Penny does not automatically retry commands.

Purchases, gifting, raw recycling, item/resource-spending upgrades, OAuth/account
security, and unknown commands are not exposed by this gateway. Recycling keeps
its dedicated `inventory.recycle` path and item protection checks. A generic
"all MCP/EOS" permission would bypass those policies; adding operations requires
explicit host review, schemas, permissions and tests.

## EOS locker

With `eos:locker:read`, call `context.eos.locker(accountId)`. The result contains
`accountId`, `filtered: true`, and `activeLoadoutGroup.loadouts` with
`shuffleType`, `loadoutSlots[].slotTemplate`, and `equippedItemId`. Unknown fields
and raw customizations are omitted. The EOS token never leaves Penny.

This is the supported EOS locker read operation, not a general EOS gateway.
Locker writes, identity services, arbitrary deployments and token endpoints remain
unavailable to plugins.

## Limits and lifecycle

- Current selected accounts only, with runtime, permission, declaration and
  selection-generation checks after awaits and immediately before transport.
- One MCP/EOS request at a time per plugin, with two seconds between reads and
  30 seconds between command requests. MCP commands serialize per account across
  plugins; one MCP command confirmation may be open at a time.
- MCP responses: at most 8 MiB over transport, 30,000 items and 4 MiB after
  filtering. EOS response: at most 1 MiB and 100 loadout groups/slots per group.
- Twenty-second transport timeout, no redirects, no caller-supplied URLs/headers,
  and no raw service error details in plugin responses or diagnostics.

Disabling/reloading the plugin, changing scope (including away and back), or
removing access prevents later dispatch and discards pending data. A server
request already sent cannot be undone by cancellation. These checks are not an
atomic transaction with the game; concurrent game changes remain possible.
