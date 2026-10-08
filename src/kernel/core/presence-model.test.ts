import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import { describe, expect, it } from 'vitest'

import {
  backoffDelay,
  buildPresencePayload,
  failureFromHttp,
  failureFromSocketError,
  isFortniteGameProcess,
  PresenceFailure,
  presenceRetry,
  productVersionFrom,
  retryAfterFrom,
} from './presence-model'

function httpError(
  status: number | null,
  data: Record<string, unknown> = {},
  headers: Record<string, string> = {},
  code?: string
) {
  const config = {
    headers: new AxiosHeaders({ Authorization: 'Bearer secret-token' }),
    data: 'refresh_token=secret-refresh',
  }

  return new AxiosError(
    'request failed',
    code,
    config,
    {},
    status === null
      ? undefined
      : {
          status,
          statusText: '',
          data,
          headers,
          config,
        }
  )
}

describe('failureFromHttp', () => {
  it('maps auth refusals to sign-in-again, never leaking the request', () => {
    const failure = failureFromHttp(
      httpError(400, { error: 'invalid_grant' }),
      'auth'
    )

    expect(failure).toMatchObject({
      code: 'reauth-required',
      retryable: false,
      status: 400,
    })
    expect(JSON.stringify(failure)).not.toMatch(/secret/)
    expect(failure.message).not.toMatch(/secret/)
  })

  it('treats a publish 401 as retryable with a fresh token', () => {
    expect(failureFromHttp(httpError(401), 'publish')).toMatchObject({
      code: 'unauthorized',
      retryable: true,
    })
  })

  it('treats a publish 404 as a lost connection', () => {
    expect(failureFromHttp(httpError(404), 'publish')).toMatchObject({
      code: 'connection-lost',
      retryable: true,
    })
  })

  it('makes 403 a permanent permission failure', () => {
    expect(failureFromHttp(httpError(403), 'publish')).toMatchObject({
      code: 'permission-denied',
      retryable: false,
    })
  })

  it('respects Retry-After on 429 and Epic throttling bodies', () => {
    expect(
      failureFromHttp(httpError(429, {}, { 'retry-after': '42' }), 'publish')
    ).toMatchObject({ code: 'rate-limited', retryable: true, retryAfterMs: 42_000 })

    expect(
      failureFromHttp(
        httpError(400, {
          errorCode: 'errors.com.epicgames.common.throttled',
          messageVars: ['7'],
        }),
        'publish'
      )
    ).toMatchObject({ code: 'rate-limited', retryAfterMs: 7_000 })
  })

  it('retries server errors, timeouts and network loss', () => {
    expect(failureFromHttp(httpError(503), 'connect')).toMatchObject({
      code: 'server',
      retryable: true,
    })
    expect(
      failureFromHttp(httpError(null, {}, {}, 'ECONNABORTED'), 'publish')
    ).toMatchObject({ code: 'timeout', retryable: true })
    expect(failureFromHttp(httpError(null), 'publish')).toMatchObject({
      code: 'network',
      retryable: true,
    })
  })

  it('does not retry other client errors', () => {
    expect(failureFromHttp(httpError(400), 'publish')).toMatchObject({
      code: 'rejected',
      retryable: false,
    })
  })

  it('recognises cancellation', () => {
    expect(failureFromHttp(new CanceledError(), 'auth').code).toBe('aborted')
  })

  it('passes PresenceFailures through', () => {
    const failure = new PresenceFailure('identity-mismatch', 'x')

    expect(failureFromHttp(failure, 'auth')).toBe(failure)
  })
})

describe('retryAfterFrom', () => {
  it('reads an HTTP date', () => {
    const now = Date.parse('2026-10-07T10:00:00Z')

    expect(
      retryAfterFrom({ 'retry-after': 'Wed, 07 Oct 2026 10:00:30 GMT' }, {}, now)
    ).toBe(30_000)
  })

  it('returns null with nothing to go on', () => {
    expect(retryAfterFrom({}, {})).toBeNull()
  })
})

describe('failureFromSocketError', () => {
  it('reads handshake status codes out of ws messages', () => {
    expect(
      failureFromSocketError(new Error('Unexpected server response: 401'))
    ).toMatchObject({ code: 'unauthorized', retryable: true, status: 401 })
    expect(
      failureFromSocketError(new Error('Unexpected server response: 403'))
    ).toMatchObject({ code: 'permission-denied', retryable: false })
    expect(
      failureFromSocketError(new Error('Unexpected server response: 502'))
    ).toMatchObject({ code: 'server', retryable: true })
  })

  it('does not loop on a subprotocol mismatch', () => {
    expect(
      failureFromSocketError(
        new Error('Server sent a subprotocol but none was requested')
      )
    ).toMatchObject({ code: 'handshake', retryable: false })
  })

  it('treats anything else as network loss', () => {
    expect(failureFromSocketError(new Error('ECONNRESET'))).toMatchObject({
      code: 'network',
      retryable: true,
    })
  })
})

describe('backoffDelay', () => {
  it('grows exponentially within equal-jitter bounds', () => {
    expect(backoffDelay(1, () => 0)).toBe(1_000)
    expect(backoffDelay(1, () => 1)).toBe(2_000)
    expect(backoffDelay(3, () => 0)).toBe(4_000)
    expect(backoffDelay(3, () => 1)).toBe(8_000)
  })

  it('caps the step', () => {
    expect(backoffDelay(50, () => 1)).toBe(presenceRetry.maxMs)
  })

  it('waits at least Retry-After, up to its own cap', () => {
    expect(backoffDelay(1, () => 0, 60_000)).toBe(60_000)
    expect(backoffDelay(1, () => 0, 24 * 60 * 60_000)).toBe(
      presenceRetry.maxRetryAfterMs
    )
  })
})

describe('productVersionFrom', () => {
  it('turns Penny’s user agent into the EOS product version', () => {
    expect(
      productVersionFrom('Fortnite/++Fortnite+Release-34.40-CL-41753727-Windows')
    ).toBe('++Fortnite+Release-34.40-CL-41753727')
  })

  it('falls back when the build is unknown', () => {
    expect(productVersionFrom('custom agent')).toMatch(
      /^\+\+Fortnite\+Release-\d+\.\d+-CL-\d+$/
    )
    expect(productVersionFrom(null)).toMatch(/^\+\+Fortnite\+Release-/)
  })
})

describe('buildPresencePayload', () => {
  it('carries the text as activity and availability as status, nothing joinable', () => {
    const payload = buildPresencePayload(
      { text: 'Back soon', availability: 'away' },
      '++Fortnite+Release-34.40-CL-41753727'
    )

    expect(payload.status).toBe('away')
    expect(payload.activity).toEqual({ value: 'Back soon' })
    expect(payload.props.EOS_ProductVersion).toBe(
      '++Fortnite+Release-34.40-CL-41753727'
    )
    expect(JSON.stringify(payload)).not.toMatch(
      /bIsJoinable|bIsPlaying|partyId|sessionId|SessionId/
    )
  })
})

describe('isFortniteGameProcess', () => {
  it.each([
    'FortniteClient-Win64-Shipping.exe',
    'FortniteClient-Win64-Shipping',
    'fortniteclient-win64-shipping_EAC_EOS.exe',
    'FortniteClient-Win64-Shipping_BE.exe',
  ])('counts %s', (name) => {
    expect(isFortniteGameProcess(name)).toBe(true)
  })

  it.each(['FortniteLauncher.exe', 'EpicGamesLauncher.exe', 'Penny.exe'])(
    'ignores %s',
    (name) => {
      expect(isFortniteGameProcess(name)).toBe(false)
    }
  )
})
