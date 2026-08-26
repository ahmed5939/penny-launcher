import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  isAllowedRendererNavigation,
  isReasonableIpcPayload,
  parseSecureExternalUrl,
} from './security'

describe('main-process security boundaries', () => {
  it('allows HTTPS links without embedded credentials only', () => {
    expect(parseSecureExternalUrl('https://example.com/path')?.hostname).toBe(
      'example.com'
    )
    expect(parseSecureExternalUrl('http://example.com')).toBeNull()
    expect(parseSecureExternalUrl('file:///etc/passwd')).toBeNull()
    expect(parseSecureExternalUrl('https://user:pass@example.com')).toBeNull()
  })

  it('requires the exact dev origin or packaged renderer file', () => {
    const rendererFilePath = '/opt/penny/renderer/index.html'

    expect(
      isAllowedRendererNavigation('http://localhost:5173/accounts', {
        devServerUrl: 'http://localhost:5173',
        rendererFilePath,
      })
    ).toBe(true)
    expect(
      isAllowedRendererNavigation('http://localhost:5173.evil.test', {
        devServerUrl: 'http://localhost:5173',
        rendererFilePath,
      })
    ).toBe(false)
    expect(
      isAllowedRendererNavigation(pathToFileURL(rendererFilePath).toString(), {
        rendererFilePath,
      })
    ).toBe(true)
    expect(
      isAllowedRendererNavigation('file:///etc/passwd', { rendererFilePath })
    ).toBe(false)
  })

  it('rejects oversized and deeply nested IPC payloads', () => {
    expect(isReasonableIpcPayload({ accountId: 'abc', enabled: true })).toBe(
      true
    )
    expect(isReasonableIpcPayload('x'.repeat(1_000_001))).toBe(false)

    let nested: unknown = 'value'
    for (let index = 0; index < 14; index += 1) nested = [nested]

    expect(isReasonableIpcPayload(nested)).toBe(false)
  })
})
