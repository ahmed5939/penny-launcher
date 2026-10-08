import type {
  PresenceAvailability,
  PresenceErrorCode,
} from '../../types/presence'

import { isAxiosError, isCancel } from 'axios'

/**
 * The pure half of native presence: payload shape, error classification and
 * retry timing. No Electron, no sockets, no tokens held.
 *
 * Reference: fnapi-js @ 8f652522e7ff41a8b1f360246daad92738522e73
 * (`src/epic/chat.ts` buildPresencePayload, `src/epic/connect.ts`). That is
 * reverse-engineered, not an Epic contract, so every shape here is one to
 * re-check when Epic changes something.
 */

export type PresenceStage = 'auth' | 'connect' | 'publish'

export type PresenceStatus = {
  text: string
  availability: PresenceAvailability
}

export class PresenceFailure extends Error {
  readonly code: PresenceErrorCode | 'aborted'
  readonly retryable: boolean
  readonly retryAfterMs: number | null
  readonly status: number | null

  constructor(
    code: PresenceErrorCode | 'aborted',
    message: string,
    {
      retryable = false,
      retryAfterMs = null,
      status = null,
    }: {
      retryable?: boolean
      retryAfterMs?: number | null
      status?: number | null
    } = {}
  ) {
    super(message)
    this.name = 'PresenceFailure'
    this.code = code
    this.retryable = retryable
    this.retryAfterMs = retryAfterMs
    this.status = status
  }
}

export function abortedFailure() {
  return new PresenceFailure('aborted', 'Presence was stopped.')
}

export function isAborted(error: unknown) {
  return error instanceof PresenceFailure && error.code === 'aborted'
}

const stageNoun: Record<PresenceStage, string> = {
  auth: 'sign in for presence',
  connect: "connect to Epic's presence service",
  publish: 'publish the status',
}

/**
 * Turns an HTTP failure into something the page can show. Never carries the
 * request: axios errors hold the Authorization header and form body.
 */
export function failureFromHttp(
  error: unknown,
  stage: PresenceStage
): PresenceFailure {
  if (error instanceof PresenceFailure) {
    return error
  }

  if (isCancel(error) || (isAxiosError(error) && error.code === 'ERR_CANCELED')) {
    return abortedFailure()
  }

  if (!isAxiosError(error)) {
    return new PresenceFailure(
      'unknown',
      `Could not ${stageNoun[stage]}. Try again.`,
      { retryable: true }
    )
  }

  const status = error.response?.status ?? null
  const body = (error.response?.data ?? {}) as Record<string, unknown>
  const epicCode = typeof body.errorCode === 'string' ? body.errorCode : ''
  const oauthError = typeof body.error === 'string' ? body.error : ''

  if (status === null) {
    return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      ? new PresenceFailure(
          'timeout',
          `Epic took too long to answer while trying to ${stageNoun[stage]}.`,
          { retryable: true }
        )
      : new PresenceFailure(
          'network',
          `Could not reach Epic to ${stageNoun[stage]}. Check the connection.`,
          { retryable: true }
        )
  }

  if (status === 429 || epicCode.endsWith('.throttled')) {
    return new PresenceFailure(
      'rate-limited',
      'Epic is rate-limiting presence. Penny will wait before trying again.',
      {
        retryable: true,
        retryAfterMs: retryAfterFrom(error.response?.headers, body),
        status,
      }
    )
  }

  if (status >= 500) {
    return new PresenceFailure(
      'server',
      `Epic's service failed (HTTP ${status}) while trying to ${stageNoun[stage]}.`,
      { retryable: true, status }
    )
  }

  if (status === 403) {
    return new PresenceFailure(
      'permission-denied',
      `Epic refused presence for this account (HTTP 403). It may not be allowed for this sign-in.`,
      { status }
    )
  }

  if (stage === 'auth' && (status === 400 || status === 401)) {
    return new PresenceFailure(
      'reauth-required',
      `Epic would not sign this account in for presence (HTTP ${status}${
        oauthError || epicCode ? `, ${oauthError || epicCode}` : ''
      }). Sign in to the account again, then retry.`,
      { status }
    )
  }

  if (status === 401) {
    return new PresenceFailure(
      'unauthorized',
      'Epic did not accept the presence sign-in (HTTP 401).',
      { retryable: true, status }
    )
  }

  if (stage === 'publish' && status === 404) {
    return new PresenceFailure(
      'connection-lost',
      'Epic no longer knows this presence connection.',
      { retryable: true, status }
    )
  }

  return new PresenceFailure(
    'rejected',
    `Epic rejected the request to ${stageNoun[stage]} (HTTP ${status}${
      epicCode ? `, ${epicCode}` : ''
    }).`,
    { status }
  )
}

/**
 * `Retry-After` as seconds or an HTTP date, or Epic's throttling body whose
 * first message variable is the wait in seconds.
 */
export function retryAfterFrom(
  headers: unknown,
  body: Record<string, unknown> = {},
  now = Date.now()
): number | null {
  const raw =
    headers && typeof headers === 'object'
      ? (headers as Record<string, unknown>)['retry-after']
      : undefined

  if (typeof raw === 'string' || typeof raw === 'number') {
    const seconds = Number(raw)

    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1_000
    }

    const date = Date.parse(String(raw))

    if (Number.isFinite(date)) {
      return Math.max(0, date - now)
    }
  }

  const vars = body.messageVars

  if (Array.isArray(vars)) {
    const seconds = Number(vars[0])

    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1_000
    }
  }

  return null
}

/** ws reports handshake failures only as message text. */
export function failureFromSocketError(error: unknown): PresenceFailure {
  if (error instanceof PresenceFailure) {
    return error
  }

  const message = error instanceof Error ? error.message : String(error)
  const unexpected = message.match(/Unexpected server response: (\d{3})/)

  if (unexpected) {
    const status = Number(unexpected[1])

    if (status === 401) {
      return new PresenceFailure(
        'unauthorized',
        "Epic's presence service did not accept the sign-in (HTTP 401).",
        { retryable: true, status }
      )
    }

    if (status === 403) {
      return new PresenceFailure(
        'permission-denied',
        "Epic's presence service refused this account (HTTP 403).",
        { status }
      )
    }

    if (status === 429) {
      return new PresenceFailure(
        'rate-limited',
        'Epic is rate-limiting presence connections. Penny will wait before trying again.',
        { retryable: true, status }
      )
    }

    return new PresenceFailure(
      status >= 500 ? 'server' : 'handshake',
      `Epic's presence service refused the connection (HTTP ${status}).`,
      { retryable: status >= 500, status }
    )
  }

  if (/subprotocol/i.test(message)) {
    return new PresenceFailure(
      'handshake',
      "Epic's presence service answered in a way Penny does not understand. Penny may need an update."
    )
  }

  return new PresenceFailure(
    'network',
    "Lost the connection to Epic's presence service.",
    { retryable: true }
  )
}

export const presenceRetry = {
  baseMs: 2_000,
  maxMs: 5 * 60 * 1_000,
  /** A Retry-After longer than this is treated as this. */
  maxRetryAfterMs: 15 * 60 * 1_000,
  /** Consecutive failed attempts before Penny stops and asks. */
  maxAttempts: 8,
}

/**
 * Exponential with equal jitter: half the step is fixed, half random, so a
 * fleet of clients that dropped together does not come back together.
 */
export function backoffDelay(
  attempt: number,
  random: () => number,
  retryAfterMs: number | null = null
) {
  const step = Math.min(
    presenceRetry.maxMs,
    presenceRetry.baseMs * 2 ** Math.max(0, attempt - 1)
  )
  const delay = step / 2 + random() * (step / 2)

  return retryAfterMs === null
    ? Math.round(delay)
    : Math.round(
        Math.max(delay, Math.min(retryAfterMs, presenceRetry.maxRetryAfterMs))
      )
}

/** Shipped in fnapi-js; only used when Penny knows no build at all. */
const fallbackProductVersion = '++Fortnite+Release-40.30-CL-53093531'

/**
 * `Fortnite/++Fortnite+Release-34.40-CL-41753727-Windows` (Penny's user
 * agent, read from the installed game's manifest) → the
 * `++Fortnite+Release-34.40-CL-41753727` EOS expects.
 */
export function productVersionFrom(userAgent: string | null | undefined) {
  const match = userAgent?.match(/\+\+Fortnite\+Release-(\d+\.\d+)-CL-(\d+)/)

  return match
    ? `++Fortnite+Release-${match[1]}-CL-${match[2]}`
    : fallbackProductVersion
}

/**
 * The EOS presence body.
 *
 * `activity.value` is the line friends see instead of "In the launcher";
 * `status` is availability. `EOS_Session` / `EOS_Lobby` are the empty
 * version markers the game client sends with no session or lobby in them —
 * nothing here says the account is in a match, a party, or joinable.
 */
export function buildPresencePayload(
  status: PresenceStatus,
  productVersion: string
) {
  return {
    status: status.availability,
    activity: { value: status.text },
    props: {
      EOS_Platform: 'WIN',
      EOS_IntegratedPlatform: 'EGS',
      EOS_OnlinePlatformType: '100',
      EOS_ProductVersion: productVersion,
      EOS_ProductName: 'Fortnite',
      EOS_Session: '{"version":3}',
      EOS_Lobby: '{"version":3}',
    },
    conn: { props: {} },
  }
}

export function sameStatus(
  a: PresenceStatus | null,
  b: PresenceStatus | null
) {
  return (
    a !== null &&
    b !== null &&
    a.text === b.text &&
    a.availability === b.availability
  )
}

/**
 * The game itself, under any anti-cheat wrapper name. The process list says
 * nothing about which account is signed in, so any running copy counts.
 */
const fortniteGameProcess =
  /^FortniteClient-Win64-Shipping(?:_EAC_EOS|_EAC|_BE)?(?:\.exe)?$/i

export function isFortniteGameProcess(name: string) {
  return fortniteGameProcess.test(name)
}

/** First six characters: enough to tell accounts apart in a log. */
export function shortAccountId(accountId: string) {
  return `${accountId.slice(0, 6)}…`
}
