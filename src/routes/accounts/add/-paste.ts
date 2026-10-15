/**
 * Reads what Epic's pages and saved files hand over, so pasting the whole
 * text works as well as pasting the bare value.
 */

export type DeviceAuth = {
  accountId: string
  deviceId: string
  secret: string
}

/**
 * Returns the code inside pasted text: the `authorizationCode` of a JSON
 * blob, the `code` of a redirect URL, or the text itself. Anything else comes
 * back trimmed and unchanged, so the form's length check reports it.
 */
export function extractAuthorizationCode(text: string): string {
  const trimmed = text.trim()
  const json = readJSON(trimmed)

  if (json) {
    return stringField(json, 'authorizationCode') ?? trimmed
  }

  return codeFromURL(trimmed) ?? trimmed
}

/**
 * Reads a saved device auth JSON, in either camelCase or snake_case. All three
 * values are needed; a partial one is not a device auth.
 */
export function parseDeviceAuth(text: string): DeviceAuth | null {
  const json = readJSON(text.trim())

  if (!json) {
    return null
  }

  const accountId = stringField(json, 'accountId', 'account_id')
  const deviceId = stringField(json, 'deviceId', 'device_id')
  const secret = stringField(json, 'secret')

  if (!accountId || !deviceId || !secret) {
    return null
  }

  return { accountId, deviceId, secret }
}

function readJSON(text: string): Record<string, unknown> | null {
  if (!text.startsWith('{')) {
    return null
  }

  try {
    const value: unknown = JSON.parse(text)

    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

function codeFromURL(text: string): string | null {
  try {
    return new URL(text).searchParams.get('code')
  } catch {
    return null
  }
}

function stringField(
  source: Record<string, unknown>,
  ...keys: Array<string>
): string | null {
  for (const key of keys) {
    const value = source[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
