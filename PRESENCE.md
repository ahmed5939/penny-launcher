# Fortnite presence

Native account page (`/account-management/presence`, beta) that holds up a
custom friend-facing status line for one linked account while Fortnite is
closed. Built 7 October 2026 from the native-presence handover; replaces the
earlier Discord-command and add-on proposals. The plugin system is untouched.

**Live status: not run.** Nothing here has signed in to Epic, opened the
connect socket, or published presence. Every test uses mocked auth, HTTP,
sockets, clocks and accounts. The feature stays `beta` until the acceptance
test below passes with a friend observer.

## Provenance

Reverse-engineered, not an Epic contract. Reference: fnapi-js
(github.com/AjaxFNC-YT/fnapi-js) pinned at
`8f652522e7ff41a8b1f360246daad92738522e73` (2.0.6-beta.0, 30 Aug 2026):
`src/epic/session.ts` (`userEasToken`, `setCustomStatus`), `src/epic/eos.ts`
(`easRefreshGrant`), `src/epic/connect.ts`, `src/epic/chat.ts`
(`buildPresencePayload`, `sendPresence`). fnapi-js is **not** a dependency;
npm's `latest` (1.1.3) predates this code. The only new runtime dependency is
`ws` (already installed through fnbr/stanza at 8.21.3), now declared directly
and kept external in `vite.base.config.ts`.

## How it works

| Step | Code | Notes |
|---|---|---|
| Account token | `device_auth` grant with the account's saved device auth | Only Epic refusing it (400/401) means "sign in again"; Penny's own check then flags the account as usual. Network and server errors stay retryable. Penny's own account token is not touched. |
| Presence game token | `GET /account/api/oauth/exchange` → `exchange_code` grant, Android client | A session of presence's own. |
| EAS user token | `POST api.epicgames.dev/epic/oauth/v2/token`, `refresh_token`, scope `basic_profile friends_list presence openid`, deployment `62a9473a2dca46b29ccf17577fcf42d7` | Renews with its own refresh token; the chain re-runs only when that is refused. Account id must match the selected account or nothing is published. |
| Connection | `wss://connect.epicgames.dev/` with Bearer + `Epic-Connect-Protocol: stomp` headers → `CONNECT` → `SUBSCRIBE launcher` → `core.connect.v1.connected` | `ws` is not given a `protocols` argument (see `presence-transport.ts`). All other inbound frames are dropped unread. |
| Publish | `PATCH /epic/presence/v1/{deployment}/{account}/presence/{connection}` | `activity.value` = text, `status` = online/away, `EOS_ProductVersion` from the installed build. No party, session or joinable flags. |

Tokens live in main-process memory only, per session, and are forgotten on
Stop. Nothing is revoked: the presence-owned sessions lapse on Epic's side,
and Penny's own account token is never touched.

## Behaviour

- One session, one account. Start for another account is refused unless the
  user confirms a replace (two-press button), which closes the first.
- Active means Epic accepted the status on the current connection. Every new
  connection republishes text and availability before it is Active again.
- Update succeeds only when Epic accepts it. A refused update keeps the old
  status showing and is not retried on reconnect.
- Lost connection: Reconnecting, exponential backoff with equal jitter (2 s
  step, 5 min cap), Retry-After honoured (up to 15 min), 8 attempts, then
  stops with an error. Sign-in and permission refusals stop at once.
- Duration is a wall-clock deadline (30 min to 4 h, or until stopped),
  re-checked after sleep and before each reconnect.
- Any running `FortniteClient-Win64-Shipping*` stops the session with a
  reason, and it does not restart by itself. The process list cannot tell
  which account the game is signed in to, so any copy counts.
- Removing the account stops its session. Changing the title-bar account
  never moves a session. Quit closes the socket inside the existing 3 s
  shutdown window; after a crash or power loss Epic expires it on its own.
- No periodic re-PATCH (the reference repeats every 30 s). Socket heartbeats
  every 30 s, plus pings once the server has shown it answers them.

## Acceptance test (needs explicit authorization)

Use a linked test account and a separate friend observer in current
Fortnite. Record timestamps; never print credentials.

1. Start → status reaches Active (EAS token, connection id, PATCH accepted).
2. Observer sees the text in place of "In the launcher" while the publishing
   account's game is closed. Note exactly what they see.
3. Update text and switch to Away → observer sees both.
4. Stop, and separately let a 30-minute session expire → record how long the
   observer's view takes to clear or fall back.
5. Pull the network for a minute → Reconnecting, then Active with no
   duplicate sessions.
6. Launch Fortnite on the publishing account → Penny steps aside and the
   game's own presence is correct.
7. Remove the account, and quit Penny → connection closes; other accounts
   and Penny's own sign-ins still work.
8. Leave it Active for 30+ minutes and check the observer still sees it. If
   it vanishes, the periodic re-PATCH is needed: a timer in
   `PresenceController`, next to the expiry timer, that re-sends the
   confirmed status with `publishOnce` while Active.

An accepted PATCH alone is not proof that friends see the status.
