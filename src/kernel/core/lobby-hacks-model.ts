import type {
  LobbyHackOutcome,
  LobbyHackResult,
  LobbyHackReward,
} from '../../types/lobby-hacks'

import { isAxiosError } from 'axios'

import { redactSecrets } from '../secret-redaction'

/**
 * Reading Epic's answer to `ExecuteTerminalCommand`. Pure, so every branch
 * is testable without a network or Electron.
 *
 * The notification shapes come from community protocol docs and have not
 * been seen on a live redemption yet. Error codes for this operation are
 * not documented at all: `classifyTerminalCommandError` maps by the shape
 * of Epic's usual codes, and the raw code is always passed on so the page
 * can show it beside the verdict.
 */

export type LobbyHackVerdict = Omit<LobbyHackResult, 'accountId' | 'finishedAt'>

export type RewardNamer = (itemType: string) => {
  name: string
  imageUrl: string | null
}

const maxRewards = 100
const maxMessageLength = 300
const maxRetryAfterSeconds = 24 * 60 * 60

export function verdict(
  outcome: LobbyHackOutcome,
  rest: Partial<LobbyHackVerdict> = {}
): LobbyHackVerdict {
  return {
    outcome,
    canRepeat: null,
    rewards: [],
    httpStatus: null,
    errorCode: null,
    errorMessage: null,
    retryAfterSeconds: null,
    ...rest,
  }
}

type Notification = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

/**
 * The response's `notifications`, plus any carried by `multiUpdate` for
 * another profile (a reward filed on common_core reports there).
 */
export function terminalCommandNotifications(data: unknown): Array<Notification> {
  if (!isRecord(data)) {
    return []
  }

  return [
    ...records(data.notifications),
    ...records(data.multiUpdate).flatMap((update) =>
      records(update.notifications)
    ),
  ]
}

/**
 * Items from `questClaim`: `loot.items[]` and
 * `questsAndRewards[].loot.items[]`. An item listed in both (same
 * `itemGuid`) is counted once.
 */
export function terminalCommandRewards(
  notifications: Array<Notification>,
  nameOf: RewardNamer
): Array<LobbyHackReward> {
  const seen = new Set<string>()
  const rewards: Array<LobbyHackReward> = []

  const take = (loot: unknown) => {
    if (!isRecord(loot)) {
      return
    }

    for (const item of records(loot.items)) {
      if (rewards.length >= maxRewards) {
        return
      }

      const itemType =
        typeof item.itemType === 'string' ? item.itemType.trim() : ''

      if (!itemType) {
        continue
      }

      if (typeof item.itemGuid === 'string' && item.itemGuid) {
        if (seen.has(item.itemGuid)) {
          continue
        }

        seen.add(item.itemGuid)
      }

      const quantity =
        typeof item.quantity === 'number' &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
          ? item.quantity
          : null
      const { name, imageUrl } = nameOf(itemType)

      rewards.push({
        itemType,
        name,
        quantity,
        itemProfile:
          typeof item.itemProfile === 'string' && item.itemProfile
            ? item.itemProfile
            : null,
        imageUrl,
      })
    }
  }

  for (const notification of notifications) {
    if (notification.type !== 'questClaim') {
      continue
    }

    take(notification.loot)

    for (const entry of records(notification.questsAndRewards)) {
      take(entry.loot)
    }
  }

  return rewards
}

/**
 * A 2xx answer. Only `terminalCommandResult.rewardGranted` decides whether
 * rewards were granted: a success status alone does not say so, and a
 * missing or malformed notification is reported as unconfirmed.
 */
export function readTerminalCommandResponse(
  data: unknown,
  nameOf: RewardNamer,
  httpStatus: number | null = null
): LobbyHackVerdict {
  const notifications = terminalCommandNotifications(data)
  const rewards = terminalCommandRewards(notifications, nameOf)
  const result = notifications.find(
    (notification) => notification.type === 'terminalCommandResult'
  )
  const canRepeat =
    typeof result?.canRepeat === 'boolean' ? result.canRepeat : null

  if (!result || typeof result.rewardGranted !== 'boolean') {
    return verdict('unconfirmed', { canRepeat, rewards, httpStatus })
  }

  return verdict(result.rewardGranted ? 'granted' : 'no-reward', {
    canRepeat,
    rewards,
    httpStatus,
  })
}

/**
 * Failed before anything reached Epic: the name did not resolve or the
 * connection was refused. Every other failure without a response (timeout,
 * reset) may have arrived.
 */
const notSentCodes = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'])

const rules: Array<[LobbyHackOutcome, RegExp]> = [
  ['auth-failed', /authentication|invalid_token|token_verification|\.oauth\./],
  ['cooldown', /throttl|cooldown|rate_limit|too_many/],
  ['already-used', /already|code_used|_redeemed|_claimed/],
  [
    'invalid-code',
    /(invalid|unknown|not_found|bad)[a-z_]*(command|code|cheat|hack|terminal)|(command|code|cheat|hack|terminal)[a-z_]*(invalid|unknown|not_found)/,
  ],
  [
    'unavailable',
    /operation_not_found|operation_forbidden|missing_action|missing_permission|not_enabled|disabled|unavailable|not_allowed|forbidden/,
  ],
]

/**
 * A failed request, reduced to what the page may show: an outcome, the HTTP
 * status, Epic's error code and message. Never the request, its headers or
 * the code that was sent.
 */
export function classifyTerminalCommandError(error: unknown): LobbyHackVerdict {
  if (!isAxiosError(error)) {
    return verdict('uncertain')
  }

  const response = error.response

  if (!response) {
    return verdict(
      error.code && notSentCodes.has(error.code) ? 'not-sent' : 'uncertain'
    )
  }

  const status = response.status
  const body = isRecord(response.data) ? response.data : {}
  const errorCode =
    typeof body.errorCode === 'string' && body.errorCode
      ? body.errorCode.slice(0, 200)
      : null
  const errorMessage = cleanMessage(body.errorMessage)
  const code = errorCode?.toLowerCase() ?? ''
  const rest = { httpStatus: status, errorCode, errorMessage }

  if (status === 401) {
    return verdict('auth-failed', rest)
  }

  if (status === 429) {
    return verdict('cooldown', {
      ...rest,
      retryAfterSeconds: retryAfter(response.headers, body),
    })
  }

  for (const [outcome, pattern] of rules) {
    if (code && pattern.test(code)) {
      return verdict(outcome, {
        ...rest,
        retryAfterSeconds:
          outcome === 'cooldown' ? retryAfter(response.headers, body) : null,
      })
    }
  }

  if (status === 403 || status === 404) {
    return verdict('unavailable', rest)
  }

  // A gateway error or crash says nothing about whether the command ran.
  if (status >= 500) {
    return verdict('uncertain', rest)
  }

  return verdict('rejected', rest)
}

function cleanMessage(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const text = redactSecrets(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .trim()

  if (!text) {
    return null
  }

  return text.length > maxMessageLength
    ? `${text.slice(0, maxMessageLength - 1)}…`
    : text
}

function seconds(value: unknown) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN

  return Number.isInteger(parsed) && parsed > 0 && parsed <= maxRetryAfterSeconds
    ? parsed
    : null
}

/** `Retry-After` in seconds, else Epic's throttle message variable. */
function retryAfter(headers: unknown, body: Record<string, unknown>) {
  const header = readHeader(headers, 'retry-after')
  const fromHeader = seconds(header)

  if (fromHeader !== null) {
    return fromHeader
  }

  return Array.isArray(body.messageVars) ? seconds(body.messageVars[0]) : null
}

function readHeader(headers: unknown, name: string) {
  if (!headers || typeof headers !== 'object') {
    return undefined
  }

  // AxiosHeaders looks names up case-insensitively; a plain object may not.
  const withGet = headers as { get?: (key: string) => unknown }

  if (typeof withGet.get === 'function') {
    return withGet.get(name) ?? undefined
  }

  const record = headers as Record<string, unknown>

  return record[name] ?? record[name.replace(/(^|-)\w/g, (s) => s.toUpperCase())]
}
