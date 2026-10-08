import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it, vi } from 'vitest'

import type { EasTokenResponse } from '../../services/endpoints/presence'

import { PresenceAuth, presenceAuthMarginMs } from './presence-auth'
import { PresenceFailure } from './presence-model'

const accountId = 'a'.repeat(32)

function easToken(overrides: Partial<EasTokenResponse> = {}): EasTokenResponse {
  return {
    access_token: 'eas-access-1',
    expires_in: 7_200,
    refresh_token: 'eas-refresh-1',
    refresh_expires_in: 28_800,
    account_id: accountId,
    ...overrides,
  }
}

function rejected(status: number) {
  const config = { headers: new AxiosHeaders() }

  return new AxiosError('rejected', undefined, config, {}, {
    status,
    statusText: '',
    data: { error: 'invalid_grant' },
    headers: {},
    config,
  })
}

function setup() {
  let now = 1_000_000
  const deps = {
    now: () => now,
    mintGameRefreshToken: vi.fn<
      (accountId: string, signal: AbortSignal) => Promise<string>
    >(async () => 'android-refresh'),
    requestEasToken: vi.fn<
      (refreshToken: string, signal: AbortSignal) => Promise<EasTokenResponse>
    >(async () => easToken()),
  }
  const auth = new PresenceAuth(accountId, deps)

  return {
    auth,
    deps,
    advance: (ms: number) => {
      now += ms
    },
    signal: new AbortController().signal,
  }
}

describe('PresenceAuth', () => {
  it('mints through the Android game refresh token, then caches', async () => {
    const { auth, deps, signal } = setup()

    await expect(auth.accessToken(signal)).resolves.toBe('eas-access-1')
    await expect(auth.accessToken(signal)).resolves.toBe('eas-access-1')

    expect(deps.mintGameRefreshToken).toHaveBeenCalledTimes(1)
    expect(deps.mintGameRefreshToken).toHaveBeenCalledWith(
      accountId,
      expect.any(AbortSignal)
    )
    expect(deps.requestEasToken).toHaveBeenCalledTimes(1)
    expect(deps.requestEasToken.mock.calls[0][0]).toBe('android-refresh')
  })

  it('renews once for any number of concurrent callers', async () => {
    const { auth, deps, signal } = setup()
    const tokens = await Promise.all([
      auth.accessToken(signal),
      auth.accessToken(signal),
      auth.accessToken(signal),
    ])

    expect(tokens).toEqual(['eas-access-1', 'eas-access-1', 'eas-access-1'])
    expect(deps.mintGameRefreshToken).toHaveBeenCalledTimes(1)
    expect(deps.requestEasToken).toHaveBeenCalledTimes(1)
  })

  it('renews with its own refresh token before expiry, not the whole chain', async () => {
    const { auth, deps, advance, signal } = setup()

    await auth.accessToken(signal)
    deps.requestEasToken.mockResolvedValueOnce(
      easToken({ access_token: 'eas-access-2', refresh_token: 'eas-refresh-2' })
    )
    advance(7_200_000 - presenceAuthMarginMs + 1)

    await expect(auth.accessToken(signal)).resolves.toBe('eas-access-2')
    expect(deps.requestEasToken.mock.calls[1][0]).toBe('eas-refresh-1')
    expect(deps.mintGameRefreshToken).toHaveBeenCalledTimes(1)
  })

  it('starts the chain over when its refresh token is refused', async () => {
    const { auth, deps, signal } = setup()

    await auth.accessToken(signal)
    auth.invalidate()
    deps.requestEasToken
      .mockRejectedValueOnce(rejected(400))
      .mockResolvedValueOnce(easToken({ access_token: 'eas-access-3' }))

    await expect(auth.accessToken(signal)).resolves.toBe('eas-access-3')
    expect(deps.mintGameRefreshToken).toHaveBeenCalledTimes(2)
  })

  it('does not hammer Epic when the refresh fails for a transient reason', async () => {
    const { auth, deps, signal } = setup()

    await auth.accessToken(signal)
    auth.invalidate()
    deps.requestEasToken.mockRejectedValueOnce(rejected(503))

    await expect(auth.accessToken(signal)).rejects.toMatchObject({
      code: 'server',
      retryable: true,
    })
    expect(deps.mintGameRefreshToken).toHaveBeenCalledTimes(1)
  })

  it('fails closed when the token is for another account, or does not say', async () => {
    for (const account_id of ['b'.repeat(32), undefined]) {
      const { auth, deps, signal } = setup()

      deps.requestEasToken.mockResolvedValueOnce(easToken({ account_id }))

      await expect(auth.accessToken(signal)).rejects.toMatchObject({
        code: 'identity-mismatch',
      })
    }
  })

  it('asks for sign-in when the account cannot be signed in', async () => {
    const { auth, deps, signal } = setup()

    deps.mintGameRefreshToken.mockRejectedValueOnce(
      new PresenceFailure('reauth-required', 'Sign in again.')
    )

    await expect(auth.accessToken(signal)).rejects.toMatchObject({
      code: 'reauth-required',
      retryable: false,
    })
  })

  it('maps a refused EAS grant to sign-in-again, never echoing tokens', async () => {
    const { auth, deps, signal } = setup()

    deps.requestEasToken.mockRejectedValueOnce(rejected(401))

    const failure = await auth.accessToken(signal).catch((error) => error)

    expect(failure).toMatchObject({ code: 'reauth-required' })
    expect(String(failure.message)).not.toMatch(/android-refresh|eas-/)
  })

  it('lets one caller stop waiting without cancelling the others', async () => {
    const { auth, deps } = setup()
    let finish: (token: EasTokenResponse) => void = () => {}

    deps.requestEasToken.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve))
    )

    const impatient = new AbortController()
    const first = auth.accessToken(impatient.signal)
    const second = auth.accessToken(new AbortController().signal)

    await vi.waitFor(() => expect(deps.requestEasToken).toHaveBeenCalled())
    impatient.abort()
    await expect(first).rejects.toMatchObject({ code: 'aborted' })

    finish(easToken())
    await expect(second).resolves.toBe('eas-access-1')
  })

  it('cancels its renewal and refuses work once disposed', async () => {
    const { auth, deps, signal } = setup()
    let renewalSignal: AbortSignal | undefined

    deps.mintGameRefreshToken.mockImplementationOnce(
      (_id: string, abort: AbortSignal) =>
        new Promise((_, reject) => {
          renewalSignal = abort
          abort.addEventListener('abort', () =>
            reject(new PresenceFailure('aborted', 'stopped'))
          )
        })
    )

    const pending = auth.accessToken(signal)

    await vi.waitFor(() => expect(renewalSignal).toBeDefined())
    auth.dispose()

    expect(renewalSignal?.aborted).toBe(true)
    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
    await expect(auth.accessToken(signal)).rejects.toMatchObject({
      code: 'aborted',
    })
  })
})
