import type { LobbyHackRequest } from '../types/lobby-hacks'

/**
 * Admin Panel code rules, shared so the form can say what the main process
 * would refuse before anything is sent. The main process still checks every
 * request itself.
 *
 * A Lobby Hack code is sent as typed: only the surrounding whitespace goes.
 * Case, punctuation, hyphens and inner spaces are part of the code, so the
 * product-code normaliser on the Redeem page (which strips them) must not be
 * used here.
 */

/**
 * Penny's own cap, not Epic's: the server limit has not been measured.
 * Counted in characters (code points), as the user sees them.
 */
export const lobbyHackCodeMaxLength = 256

const accountIdPattern = /^[0-9a-f]{32}$/i

/** Line feeds, carriage returns, NEL, vertical tab, form feed, U+2028/9. */
const lineBreaks = /[\n\r\v\f\u0085\u2028\u2029]/

/*
 * The rest of C0/C1 (tabs included) and the bidi overrides that can make a
 * code read differently from what is sent.
 */
// eslint-disable-next-line no-control-regex
const forbiddenCharacters = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/

export type LobbyHackCodeProblem =
  | 'blank'
  | 'line-break'
  | 'characters'
  | 'too-long'

export type LobbyHackCodeCheck =
  | { ok: true; code: string; length: number }
  | { ok: false; reason: LobbyHackCodeProblem; length: number }

export function lobbyHackCodeLength(code: string) {
  return Array.from(code).length
}

/** Trims, then checks. `code` in the result is exactly what would be sent. */
export function checkLobbyHackCode(raw: string): LobbyHackCodeCheck {
  const code = raw.trim()
  const length = lobbyHackCodeLength(code)

  if (length === 0) {
    return { ok: false, reason: 'blank', length }
  }

  // Two lines is two codes; one submission carries one.
  if (lineBreaks.test(code)) {
    return { ok: false, reason: 'line-break', length }
  }

  if (forbiddenCharacters.test(code) || !isWellFormed(code)) {
    return { ok: false, reason: 'characters', length }
  }

  if (length > lobbyHackCodeMaxLength) {
    return { ok: false, reason: 'too-long', length }
  }

  return { ok: true, code, length }
}

/**
 * A single-line input quietly joins pasted lines into one, which would turn
 * two codes into a third that is neither. The form refuses such a paste
 * instead.
 */
export function isMultiLinePaste(text: string) {
  return lineBreaks.test(text.trim())
}

export function isLobbyHackAccountId(value: unknown): value is string {
  return typeof value === 'string' && accountIdPattern.test(value)
}

export type ParsedLobbyHackRequest =
  | { ok: true; request: LobbyHackRequest }
  | { ok: false; accountId: string | null }

/**
 * Rebuilds a request from untrusted input, keeping only the account id and
 * the trimmed code.
 */
export function parseLobbyHackRequest(input: unknown): ParsedLobbyHackRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, accountId: null }
  }

  const value = input as Record<string, unknown>
  const accountId = isLobbyHackAccountId(value.accountId)
    ? value.accountId
    : null

  if (!accountId || typeof value.code !== 'string') {
    return { ok: false, accountId }
  }

  const check = checkLobbyHackCode(value.code)

  if (!check.ok) {
    return { ok: false, accountId }
  }

  return { ok: true, request: { accountId, code: check.code } }
}

/** No lone surrogates: they cannot be encoded as sent. */
function isWellFormed(text: string) {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index)

    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1)

      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return false
      }

      index += 1
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false
    }
  }

  return true
}
