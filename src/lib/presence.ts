import type {
  PresenceAvailability,
  PresenceRequest,
} from '../types/presence'

/**
 * Status text and request rules, shared so the form can say what the main
 * process would refuse before anything is sent. The main process still
 * checks every request itself.
 */

/**
 * Penny's own cap, not Epic's: the service maximum has not been measured.
 * Counted in UTF-8 bytes because that is what goes over the wire.
 */
export const presenceTextMaxBytes = 128

/** Longest timed session: a day. Longer than that is "until stopped". */
export const presenceMaxDurationMinutes = 24 * 60

export const presenceDurationOptions: ReadonlyArray<{
  label: string
  minutes: number | null
}> = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: 'Until I stop it', minutes: null },
]

const accountIdPattern = /^[0-9a-f]{32}$/i

/*
 * C0/C1 controls (newlines and tabs included) and the bidi overrides that
 * can make a status read differently from what was typed. Emoji joiners and
 * variation selectors are ordinary text and pass.
 */
// eslint-disable-next-line no-control-regex
const forbiddenCharacters = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/

export function presenceTextBytes(text: string) {
  return new TextEncoder().encode(text).length
}

export type PresenceTextCheck =
  | { ok: true; text: string; bytes: number }
  | { ok: false; reason: 'blank' | 'too-long' | 'characters'; bytes: number }

/** Trims, then checks. `text` in the result is what would be published. */
export function checkPresenceText(raw: string): PresenceTextCheck {
  const text = raw.trim()
  const bytes = presenceTextBytes(text)

  if (text.length === 0) {
    return { ok: false, reason: 'blank', bytes }
  }

  if (forbiddenCharacters.test(text) || !isWellFormed(text)) {
    return { ok: false, reason: 'characters', bytes }
  }

  if (bytes > presenceTextMaxBytes) {
    return { ok: false, reason: 'too-long', bytes }
  }

  return { ok: true, text, bytes }
}

export function presenceTextProblem(
  check: Extract<PresenceTextCheck, { ok: false }>
) {
  switch (check.reason) {
    case 'blank':
      return 'Write a status first.'
    case 'characters':
      return 'Line breaks, tabs and other control characters are not allowed.'
    case 'too-long':
      return `That is ${check.bytes} bytes; the limit is ${presenceTextMaxBytes}. Emoji and accented letters count as several.`
  }
}

export type ParsedPresenceRequest =
  | { ok: true; request: PresenceRequest }
  | { ok: false; message: string }

/**
 * Rebuilds a request from untrusted input, keeping only known fields.
 */
export function parsePresenceRequest(input: unknown): ParsedPresenceRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Malformed presence request.' }
  }

  const value = input as Record<string, unknown>

  if (
    typeof value.accountId !== 'string' ||
    !accountIdPattern.test(value.accountId)
  ) {
    return { ok: false, message: 'Pick a linked account.' }
  }

  if (typeof value.text !== 'string') {
    return { ok: false, message: 'Write a status first.' }
  }

  // Bounds the work below; the byte limit is far smaller anyway.
  if (value.text.length > 4_096) {
    return {
      ok: false,
      message: `That is far over the ${presenceTextMaxBytes}-byte limit.`,
    }
  }

  const text = checkPresenceText(value.text)

  if (!text.ok) {
    return { ok: false, message: presenceTextProblem(text) }
  }

  if (!isAvailability(value.availability)) {
    return { ok: false, message: 'Choose Online or Away.' }
  }

  const duration = value.durationMinutes

  if (
    duration !== null &&
    (typeof duration !== 'number' ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > presenceMaxDurationMinutes)
  ) {
    return { ok: false, message: 'Choose how long to keep it up.' }
  }

  if (value.replaceActive !== undefined && typeof value.replaceActive !== 'boolean') {
    return { ok: false, message: 'Malformed presence request.' }
  }

  return {
    ok: true,
    request: {
      accountId: value.accountId.toLowerCase(),
      text: text.text,
      availability: value.availability,
      durationMinutes: duration as number | null,
      replaceActive: value.replaceActive === true,
    },
  }
}

function isAvailability(value: unknown): value is PresenceAvailability {
  return value === 'online' || value === 'away'
}

/** Lone surrogates encode to U+FFFD and would publish something else. */
function isWellFormed(text: string) {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1)

      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return false
      }

      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false
    }
  }

  return true
}
