# BR Lobby Hacks

Native account page (`/account-management/lobby-hacks`, beta) that submits
one Battle Royale Lobby Hack code, the kind typed into the in-game
**FORTNITE ADMIN PANEL** at the `enter_found_lobby_hacks` prompt, for one
linked account. Built 9 October 2026. It is separate from Redeem
(`/account-management/redeem-codes`), which fulfils Epic product codes
through the fulfillment service and normalises them; neither shares code
with the other.

**Live status: not verified.** No code has been submitted to Epic from
Penny. Every test uses mocked accounts, auth and HTTP. The page stays
`beta` until a code the user supplies produces a confirmed result (see
the acceptance test below). Do not guess codes or submit test codes.

## Provenance

The game's code-entry widget is
`/HackSystemFrontendUI/Widgets/WBP_HacksystemFrontendUI_EnterCheatModal`;
its submit reads the text field and calls
`/Script/CheatInputSystem.TerminalCommandContext.TryToExecuteTerminalCommand`.
The remote half is the athena profile operation `ExecuteTerminalCommand`,
documented by the community (LeleDerGrasshalmi's
FortniteEndpointsDocumentation: `ExecuteTerminalCommand`,
`terminalCommandResult`, `questClaim`, and the profile request format).
It is not an Epic contract.

## Request

```
POST https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/{accountId}/client/ExecuteTerminalCommand?profileId=athena&rvn=-1
Authorization: bearer <the selected account's access token>
Content-Type: application/json
User-Agent: <Penny's usual game User-Agent>

{ "command": "<code>" }
```

`setExecuteTerminalCommand` in `src/services/endpoints/mcp.ts`, on the
shared `baseGameService` (same host, User-Agent interceptor and 20 s
timeout as every other MCP call). The token comes from
`Authentication.verifyAccessToken`; there is no second sign-in path.

## Flow

| Step | Where | Notes |
|---|---|---|
| Form | `src/features/lobby-hacks/view.tsx` | Account picker (defaults to the title-bar account), one code field, Submit. The account the code goes to is named beside the button. |
| Validation | `src/lib/lobby-hacks.ts` (renderer and main) | Trim the edges only; case, punctuation, hyphens and inner spaces are kept. Non-empty, one line, no control characters or bidi overrides, at most 256 characters. 256 is Penny's limit, not a measured server limit. A multi-line paste is refused rather than joined. |
| IPC | `lobby-hacks:submit`, invoke, main frame only | Carries `{ accountId, code }` and nothing else. |
| Main | `src/kernel/core/lobby-hacks.ts` | Re-validates, looks the account up in `AccountsManager`, signs in, checks the account is still linked, sends once. One submission at a time across all accounts. |
| Reading | `src/kernel/core/lobby-hacks-model.ts` | Pure; covered by `lobby-hacks-model.test.ts`. |

No retry anywhere: not in the endpoint, the main process or the page. A
timeout can arrive after Epic has granted the rewards.

## Outcomes

A 2xx answer alone proves nothing. Only `terminalCommandResult` decides:

| Answer | Outcome |
|---|---|
| `terminalCommandResult.rewardGranted: true` | Granted |
| `terminalCommandResult.rewardGranted: false` | No reward |
| 2xx without a usable `terminalCommandResult` | Unconfirmed (check in game before resending) |
| Timeout, reset, or 5xx | Result unknown (check in game before resending) |
| Connection refused / DNS failure | Not sent (safe to retry) |
| 401, or an auth/oauth error code | Sign-in failed |
| 429, or a throttle/cooldown code | Cooldown (`Retry-After` or Epic's message variable) |
| `already` / `_claimed` / `_redeemed` codes | Already used |
| invalid/unknown/not-found + command/code/terminal | Code not recognised |
| operation not found/forbidden, disabled, 403/404 | Not available |
| Any other 4xx | Refused, with Epic's code and message |

Epic has not documented error codes for this operation. The mapping above
is by the shape of Epic's usual codes; the page always shows the raw HTTP
status, `errorCode` and (redacted, trimmed) `errorMessage` beside the
verdict. Adjust `rules` in `lobby-hacks-model.ts` once real refusals have
been seen.

Rewards are read from `questClaim` notifications: `loot.items[]` and
`questsAndRewards[].loot.items[]` (also inside `multiUpdate`), counted
once per `itemGuid`. Names come from the BR cosmetics catalogue if a
locker screen has already loaded it (never fetched for this), V-Bucks for
`Currency:Mtx*`, otherwise a name read off the template id. The raw
`itemType` is always shown under the name.

Neither the renderer nor the runtime log ever gets the token, the request,
the raw response or the code. The log line is outcome, HTTP status, Epic's
error code and the reward count.

## Known codes

The page lists the season's known codes (`src/data/lobby-hack-codes.json`,
read by `src/features/lobby-hacks/codes.ts`), grouped as Sprites, Sprite
Dust, XP, Gizmos, Cosmetics, lobby effects and expired, with a search box.
Clicking a reward code only puts it in the form; it is sent when the user
presses Submit. Lobby effects (they run in the game client) and expired
codes are listed but cannot be picked.

Epic publishes no list, and reward codes are checked server-side, so the
game holds none of them. The list was built on 9 October 2026 from five
community guides (Beebom, updated 5 October; VICE, 1 October; Game Rant;
AltChar; Skycoach), read from the pages' own tables and lists rather than
retyped. Each entry records which guides list it. Every code is in at
least two guides except `runSystemOverride` and `ImTheRealEdgelord`
(VICE only). Where guides disagree it says so in `note`: `powerout!` is
also printed `POWEROUT`, `9YEARS` is a spray or an emote, `DontBlockMe`
may turn the Tetris effect off. Rewards and quest requirements are as the
guides state them, not confirmed in game; which codes are lobby effects is
inferred from what the guides say they do.

To update: re-check the sources, add new codes with their sources, set an
`expires` day (last valid day) when a guide gives one, and bump
`checkedAt`. `codes.test.ts` checks every code is unique, passes the form's
own validation unchanged, and names its sources.

## Not in scope

The game also registers local terminal commands that transform the lobby
or trigger party effects. Those run inside the game client. This page only
submits remote reward codes and does not reproduce any local Admin Panel
effect.

## Acceptance test (needs a user-supplied code)

1. The user provides a current, unredeemed Lobby Hack code and names the
   account. Never use a guessed or sample code.
2. Submit once. Record the outcome, HTTP status, any Epic error code, and
   the rewards listed. Do not resend on Unknown or Unconfirmed; check the
   account in game first.
3. Confirm in game that the listed rewards arrived on that account.
4. Submit the same code again on the same account, and record what Epic
   answers (already used, no reward, or something else). Update `rules`
   in `lobby-hacks-model.ts` if the code was misread.
5. Only after a confirmed grant, drop `beta` from the nav entry and this
   file's live status.
