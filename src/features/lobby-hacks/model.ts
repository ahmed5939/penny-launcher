import type { CalloutTone, ChipTone } from '../../components/page'
import type {
  LobbyHackOutcome,
  LobbyHackResult,
} from '../../types/lobby-hacks'

/**
 * How each outcome reads on the page. Wording lives in
 * `locales/*\/account-management/lobby-hacks.json` under `outcomes.<outcome>`.
 */

export const lobbyHackOutcomes: ReadonlyArray<LobbyHackOutcome> = [
  'granted',
  'no-reward',
  'unconfirmed',
  'invalid-code',
  'already-used',
  'cooldown',
  'unavailable',
  'rejected',
  'auth-failed',
  'account-missing',
  'not-sent',
  'uncertain',
  'busy',
  'invalid-input',
]

const tones: Record<LobbyHackOutcome, CalloutTone> = {
  granted: 'success',
  'no-reward': 'warning',
  unconfirmed: 'warning',
  'invalid-code': 'danger',
  'already-used': 'warning',
  cooldown: 'warning',
  unavailable: 'danger',
  rejected: 'danger',
  'auth-failed': 'danger',
  'account-missing': 'danger',
  'not-sent': 'danger',
  uncertain: 'warning',
  busy: 'info',
  'invalid-input': 'danger',
}

export function outcomeTone(outcome: LobbyHackOutcome): CalloutTone {
  return tones[outcome]
}

export function outcomeChipTone(outcome: LobbyHackOutcome): ChipTone {
  const tone = tones[outcome]

  return tone === 'info' ? 'neutral' : tone
}

/**
 * The account the form submits for: the one picked on the page while it is
 * still linked, else the title-bar account, else the first linked one.
 */
export function formAccountId({
  chosen,
  linked,
  primary,
}: {
  chosen: string | null
  linked: ReadonlyArray<string>
  primary: string | null
}) {
  if (chosen && linked.includes(chosen)) {
    return chosen
  }

  if (primary && linked.includes(primary)) {
    return primary
  }

  return linked[0] ?? null
}

/** Only Epic's own `rewardGranted: true` counts as a grant. */
export function isConfirmedGrant(result: LobbyHackResult) {
  return result.outcome === 'granted'
}

/** Outcomes where sending the same code again could double up. */
export function mayHaveGoneThrough(outcome: LobbyHackOutcome) {
  return outcome === 'uncertain' || outcome === 'unconfirmed'
}

/**
 * A reply from the main process that belongs to this request. Anything
 * else is treated as an unknown result rather than trusted.
 */
export function isResultFor(
  value: unknown,
  accountId: string
): value is LobbyHackResult {
  if (!value || typeof value !== 'object') {
    return false
  }

  const result = value as Partial<LobbyHackResult>

  return (
    result.accountId === accountId &&
    typeof result.outcome === 'string' &&
    lobbyHackOutcomes.includes(result.outcome) &&
    Array.isArray(result.rewards)
  )
}

/** What the page shows when the main process gave no usable answer. */
export function unknownResult(accountId: string): LobbyHackResult {
  return {
    accountId,
    outcome: 'uncertain',
    canRepeat: null,
    rewards: [],
    httpStatus: null,
    errorCode: null,
    errorMessage: null,
    retryAfterSeconds: null,
    finishedAt: new Date().toISOString(),
  }
}
