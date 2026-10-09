/**
 * BR Lobby Hacks: one Admin Panel code, submitted for one linked account
 * through the athena `ExecuteTerminalCommand` profile operation.
 *
 * Everything here crosses IPC, so none of it may hold a token, a request
 * object or a raw response.
 */

export type LobbyHackRequest = {
  accountId: string
  /** Trimmed; otherwise exactly as typed. */
  code: string
}

export type LobbyHackOutcome =
  /** `terminalCommandResult.rewardGranted` was true. */
  | 'granted'
  /** `terminalCommandResult.rewardGranted` was false. */
  | 'no-reward'
  /** Epic answered 2xx but sent no usable `terminalCommandResult`. */
  | 'unconfirmed'
  | 'invalid-code'
  | 'already-used'
  | 'cooldown'
  /** The operation is off, forbidden or unknown to the service. */
  | 'unavailable'
  /** Any other refusal Epic explained with an error code. */
  | 'rejected'
  | 'auth-failed'
  /** The account is not (or no longer) linked in Penny. */
  | 'account-missing'
  /** Failed before the request left the machine: safe to try again. */
  | 'not-sent'
  /** No usable answer: the code may or may not have gone through. */
  | 'uncertain'
  /** Another submission is still running. Nothing was sent. */
  | 'busy'
  /** The request did not pass validation. Nothing was sent. */
  | 'invalid-input'

export type LobbyHackReward = {
  /** `MagpieEntitlementReward:magpiereward_jonesy_gold_sprite`, as Epic spells it. */
  itemType: string
  /** From the cosmetics catalogue when Penny has it, else read off the id. */
  name: string
  /** Null when Epic did not say. */
  quantity: number | null
  /** `athena`, `common_core`, … */
  itemProfile: string | null
  imageUrl: string | null
}

export type LobbyHackResult = {
  /** Always the account the request named. */
  accountId: string
  outcome: LobbyHackOutcome
  /** `terminalCommandResult.canRepeat`; null when Epic did not say. */
  canRepeat: boolean | null
  /** Items listed in the response's `questClaim` notifications. */
  rewards: Array<LobbyHackReward>
  httpStatus: number | null
  /** Epic's `errorCode` for a refusal. */
  errorCode: string | null
  /** Epic's `errorMessage` for a refusal, redacted and trimmed. */
  errorMessage: string | null
  retryAfterSeconds: number | null
  finishedAt: string
}
