# Fortnite plugin API (v6)

Penny provides an MCP gateway for every game profile and command, a matchmaking
session lookup, native presence, and an EOS locker reader. Authentication,
service addresses and request transport stay in Penny. API v4 and v5 packages
remain supported (see [Approval](#approval)).

## Declare the exact access

```json
{
  "id": "my-recycler",
  "name": "My Recycler",
  "runtime": "sandbox",
  "apiVersion": 6,
  "permissions": ["accounts:read", "fortnite:profiles", "fortnite:commands", "ui"],
  "fortnite": {
    "profiles": ["theater0", "theater2"],
    "operations": ["QueryProfile", "DisassembleWorldItems"]
  }
}
```

`profiles` may list any of: `campaign`, `athena`, `common_core`, `common_public`,
`collections`, `creative`, `metadata`, `theater0` (backpack), `theater1`,
`theater2` (Ventures backpack), `outpost0` (storage), `recycle_bin`, `profile0`,
`collection_book_people0`, `collection_book_schematics0`.

`operations` may list any MCP command name (`^[A-Z][A-Za-z0-9]{1,79}$`, up to
200), including ones Penny has never heard of. Installation/update review shows
both lists; they are part of the approved package fingerprint, so changing them
requires another review. A plugin still cannot supply a URL, header,
authentication, target-account path, revision or service deployment.

`mcp.operations()` returns the operations Penny describes: name, supported
profiles, description, permission, `alwaysConfirmed`, and a data-only
`bodySchema` for form builders. Undescribed operations work too.

## Read game profiles

```js
const { primary } = await context.accounts.getScoped()
if (!primary) throw new Error('Select an account first.')
const ventures = await context.mcp.queryProfile(primary.accountId, 'theater2')
const items = Object.entries(ventures.items)
```

A read requires `fortnite:profiles` plus the declared profile and declared
`QueryProfile`. `mcp.request(accountId, { operation: 'QueryProfile', profileId })`
uses exactly the same policy.

The result is **the profile as Epic sent it** (`items`, `stats.attributes`, `rvn`,
`commandRevision`, `created`, `updated`, …) with `filtered: true`, minus these
keys at any depth (case-insensitive):

- account secrets: `email`, `externalAuths`, access/refresh tokens, device ids,
  `secret`, `password`, session ids
- commerce and account security: `in_app_purchases`, `mtx_purchase_history`,
  `rmt_purchase_history`, `receipts`, `ban_status`, `ban_history`, `mfa_enabled`
- other people: `gift_history`, `fromAccountId`, `giftFromAccountId`,
  `toAccountId`, `userMessage`

`Receipt:` items are dropped, and so are `statModified`/`itemAttrChanged`
changes that name one of the keys above. Everything else, including fields Penny
has no schema for, is returned unchanged. Rules live in
[`plugin-profile-data.ts`](../src/kernel/startup/plugin-profile-data.ts).

## Run commands

```js
void context.jobs.run('disassemble', 'Disassemble backpack', async (signal) => {
  const { primary } = await context.accounts.getScoped()
  if (!primary || signal.aborted) return
  const result = await context.mcp.request(primary.accountId, {
    operation: 'DisassembleWorldItems', profileId: 'theater0',
    body: { targetItemIdAndQuantityPairs: [{ itemId: 'item-guid', quantity: 10 }] },
  })
  await context.log(result.cancelled ? 'Cancelled.' : `Revision ${result.response?.profileRevision}`)
})
```

Commands need `fortnite:commands` and the declared operation and profile. The
body is a JSON object up to 64 KiB. For operations Penny describes, it checks
the fields it knows (types, id format, positional arrays) and passes any other
fields through. Other operations are sent unchanged.

Described operations and their profiles include every STW command Penny itself
uses (quests, rewards, expeditions, squads, hero/defender loadouts, upgrades,
perks, research, llamas, `RecycleItemBatch`, `StorageTransfer` on `theater0`),
plus `ExecuteTerminalCommand` and `RedeemSTWAccoladeTokens` on `athena`, and
`DisassembleWorldItems` / `ModifyQuickbar` on `theater0`–`theater2`. See
[`plugin-fortnite-policy.ts`](../src/kernel/startup/plugin-fortnite-policy.ts).

A command returns `{ accountId, profileId, operation, cancelled, applied,
response }`. `response` is Epic's reply with the same redaction:
`profileRevision`, `profileChanges`, `notifications` (for example
`terminalCommandResult.rewardGranted`), `multiUpdate`. `applied: true` means the
service accepted the request. A failure reports the HTTP status and Epic's
`errors.com.epicgames…` code, never the message. An error may leave the outcome
unknown: read the profile before retrying. Penny never retries.

### Approval

- **API v6:** approving the install/update approves every declared command. They
  run without a dialog, on any selected account, at any time.
- **Always asks:** `PurchaseCatalogEntry`, `PurchaseMultipleCatalogEntries`,
  `GiftCatalogEntry`, `RefundMtxPurchase`, `RefundItem`, `SetReceiveGiftsEnabled`,
  `SetAffiliateName`, `SetMtxPlatform`, `VerifyRealMoneyPurchase`. Penny's
  **Allow once** dialog names the plugin, account, command and exact payload;
  Cancel is the default and it expires after 60 seconds.
- **API v4/v5 packages** were approved expecting a dialog per command, so every
  command they send still asks.

`RecycleItemBatch` and `DisassembleWorldItems` do not skip favorites or equipped
items. `inventory.recycle` remains the protected, confirmed route.

## Matchmaking sessions

With `fortnite:sessions`, `context.matchmaking.findPlayer(accountId)` returns
`{ accountId, sessions }`: the account's current matchmaking sessions (up to 20,
same redaction), or an empty list when it is not in a match.

## Presence

With `fortnite:presence`, plugins drive the same single presence session as
Account › Presence:

```js
await context.presence.start({ accountId, text: 'Farming', availability: 'online', durationMinutes: 60 })
await context.presence.update({ accountId, text: 'Back soon', availability: 'away', durationMinutes: 60 })
const snapshot = await context.presence.status() // null when idle or another account's
await context.presence.stop()
```

Start for a different account than the running one is refused unless the request
has `replaceActive: true`. Only selected accounts can be started, updated or
stopped. Results are `{ ok, error, snapshot }`; see [`PRESENCE.md`](../PRESENCE.md)
for states and error codes. Tokens never leave Penny.

## EOS locker

With `eos:locker:read`, call `context.eos.locker(accountId)`. The result contains
`accountId`, `filtered: true`, and `activeLoadoutGroup.loadouts` with
`shuffleType`, `loadoutSlots[].slotTemplate`, and `equippedItemId`. Unknown fields
and raw customizations are omitted. The EOS token never leaves Penny.

## Limits and lifecycle

- Current selected accounts only, with runtime, permission, declaration and
  selection-generation checks after awaits and immediately before transport.
- One MCP/session/EOS request at a time per plugin; 0.5 s between reads and 1 s
  between commands. Commands run one at a time per account across plugins; one
  confirmation dialog may be open at a time. Presence: 2 s between changes.
- MCP responses: at most 32 MiB over transport, 50,000 profile items, 16 MiB
  after redaction. Sessions and EOS: at most 1 MiB.
- Twenty-second transport timeout, no redirects, no caller-supplied URLs/headers.

Disabling/reloading the plugin, changing scope (including away and back), or
removing access prevents later dispatch and discards pending data. A request
already sent cannot be undone by cancellation. These checks are not an atomic
transaction with the game; concurrent game changes remain possible.
