import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function parseSecureExternalUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)

    return url.protocol === 'https:' && !url.username && !url.password
      ? url
      : null
  } catch {
    return null
  }
}

export function isAllowedRendererNavigation(
  rawUrl: string,
  config: { devServerUrl?: string; rendererFilePath: string }
) {
  try {
    const url = new URL(rawUrl)

    if (config.devServerUrl) {
      return url.origin === new URL(config.devServerUrl).origin
    }

    return (
      url.protocol === 'file:' &&
      path.resolve(fileURLToPath(url)) === path.resolve(config.rendererFilePath)
    )
  } catch {
    return false
  }
}

export function isReasonableIpcPayload(value: unknown, depth = 0): boolean {
  if (depth > 12) return false

  if (typeof value === 'string') return value.length <= 1_000_000

  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return (
      value.length <= 10_000 &&
      value.every((item) => isReasonableIpcPayload(item, depth + 1))
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)

    return (
      entries.length <= 10_000 &&
      entries.every(
        ([key, item]) =>
          key.length <= 256 && isReasonableIpcPayload(item, depth + 1)
      )
    )
  }

  return false
}
