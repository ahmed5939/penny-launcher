import type { PresenceSnapshot } from '../../types/presence'
import type { PresenceTokenSource } from './presence-auth'
import type { PresenceLink } from './presence-transport'

import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { abortedFailure, PresenceFailure, presenceRetry } from './presence-model'
import { PresenceController, type PresenceDeps } from './presence-session'

const alice = 'a'.repeat(32)
const bob = 'b'.repeat(32)
const secretToken = 'eas-secret-token'

class FakeAuth implements PresenceTokenSource {
  accessToken = vi.fn(async (signal: AbortSignal) => {
    if (signal.aborted) throw abortedFailure()
    return secretToken
  })
  invalidate = vi.fn()
  dispose = vi.fn()
}

/** Like the transport: a loss nobody heard yet goes to the first listener. */
class FakeLink implements PresenceLink {
  lost: ((failure: PresenceFailure) => void) | null = null
  missed: PresenceFailure | null = null
  closed = 0

  constructor(readonly connectionId: string) {}

  onLost(listener: (failure: PresenceFailure) => void) {
    const missed = this.missed

    if (missed) {
      this.missed = null
      queueMicrotask(() => listener(missed))
      return
    }

    this.lost = listener
  }

  async close() {
    this.closed += 1
  }

  drop() {
    const failure = new PresenceFailure('connection-lost', 'The connection dropped.', {
      retryable: true,
    })
    const listener = this.lost

    this.lost = null

    if (listener) {
      listener(failure)
    } else {
      this.missed = failure
    }
  }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })

  return { promise, resolve, reject }
}

function httpError(status: number, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders({ Authorization: `Bearer ${secretToken}` }) }

  return new AxiosError('failed', undefined, config, {}, {
    status,
    statusText: '',
    data: {},
    headers,
    config,
  })
}

function harness() {
  const emitted: Array<PresenceSnapshot> = []
  const auths: Array<FakeAuth> = []
  const links: Array<FakeLink> = []
  const game = {
    running: false,
    listener: null as ((running: boolean) => void) | null,
  }
  const deps = {
    now: () => Date.now(),
    random: () => 0,
    resolveAccount: vi.fn((accountId: string) =>
      accountId === alice
        ? { accountId: alice, displayName: 'Alice' }
        : accountId === bob
          ? { accountId: bob, displayName: 'Bob' }
          : null
    ),
    createAuth: vi.fn(() => {
      const auth = new FakeAuth()
      auths.push(auth)
      return auth
    }),
    connect: vi.fn(async (_token: string, signal: AbortSignal) => {
      if (signal.aborted) throw abortedFailure()
      const link = new FakeLink(`conn-${links.length + 1}`)
      links.push(link)
      return link as PresenceLink
    }),
    publish: vi.fn<PresenceDeps['publish']>(async () => {}),
    productVersion: async () => '++Fortnite+Release-34.40-CL-41753727',
    gameRunning: vi.fn(async () => game.running),
    watchGame: vi.fn((listener: (running: boolean) => void) => {
      game.listener = listener
      return () => {
        game.listener = null
      }
    }),
    emit: (snapshot: PresenceSnapshot) => emitted.push(snapshot),
    log: vi.fn(),
  } satisfies PresenceDeps

  return {
    controller: new PresenceController(deps),
    deps,
    emitted,
    auths,
    links,
    game,
    states: () => emitted.map((snapshot) => snapshot.state),
  }
}

const request = (overrides: Record<string, unknown> = {}) => ({
  accountId: alice,
  text: 'Farming Twine',
  availability: 'online',
  durationMinutes: null,
  ...overrides,
})

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-10-07T12:00:00Z') })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('starting', () => {
  it('is not Active until Epic accepts the status', async () => {
    const h = harness()
    const publish = deferred<void>()

    h.deps.publish.mockImplementationOnce(() => publish.promise)

    const started = h.controller.start(request({ availability: 'away' }))

    await vi.waitFor(() => expect(h.deps.publish).toHaveBeenCalled())
    expect(h.states()).toEqual(['connecting', 'publishing'])
    expect(h.controller.status()).toMatchObject({
      state: 'publishing',
      text: null,
      pending: { text: 'Farming Twine', availability: 'away' },
    })

    publish.resolve()
    const result = await started

    expect(result.ok).toBe(true)
    expect(result.snapshot).toMatchObject({
      accountId: alice,
      displayName: 'Alice',
      state: 'active',
      text: 'Farming Twine',
      availability: 'away',
      pending: null,
      // vi.waitFor steps the fake clock while it polls.
      lastPublishedAt: expect.stringMatching(/^2026-10-07T12:00:0\d\.\d{3}Z$/),
      expiresAt: null,
    })

    const call = h.deps.publish.mock.calls[0][0]

    expect(call).toMatchObject({
      accessToken: secretToken,
      accountId: alice,
      connectionId: 'conn-1',
    })
    expect(call.payload).toMatchObject({
      status: 'away',
      activity: { value: 'Farming Twine' },
    })
  })

  it('leaves a useful error when the publish is refused', async () => {
    const h = harness()

    h.deps.publish.mockRejectedValueOnce(httpError(403))

    const result = await h.controller.start(request())

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('permission-denied')
    expect(result.snapshot).toMatchObject({
      state: 'error',
      accountId: alice,
      displayName: 'Alice',
      errorCode: 'permission-denied',
    })
    expect(h.links[0].closed).toBe(1)
    expect(h.auths[0].dispose).toHaveBeenCalled()
    expect(h.game.listener).toBeNull()
    expect(h.states()).not.toContain('active')
  })

  it('validates in the main process and leaves a running session alone', async () => {
    const h = harness()

    await h.controller.start(request())

    for (const bad of [
      request({ text: '' }),
      request({ text: 'line\nbreak' }),
      request({ availability: 'xa' }),
      request({ durationMinutes: -5 }),
      request({ accountId: 'not-an-account' }),
      null,
    ]) {
      const result = await h.controller.start(bad)

      expect(result.error?.code).toBe('invalid-request')
      expect(result.snapshot.state).toBe('active')
    }

    expect(h.deps.connect).toHaveBeenCalledTimes(1)
  })

  it('refuses an account Penny does not have', async () => {
    const h = harness()
    const result = await h.controller.start(request({ accountId: 'c'.repeat(32) }))

    expect(result.error?.code).toBe('unknown-account')
    expect(h.deps.createAuth).not.toHaveBeenCalled()
  })

  it('opens one connection however often Start is pressed', async () => {
    const h = harness()
    const results = await Promise.all([
      h.controller.start(request()),
      h.controller.start(request()),
      h.controller.start(request()),
    ])

    expect(results.map((result) => result.ok)).toEqual([true, true, true])
    expect(h.deps.connect).toHaveBeenCalledTimes(1)
    expect(h.deps.createAuth).toHaveBeenCalledTimes(1)
    expect(h.deps.watchGame).toHaveBeenCalledTimes(1)
    expect(h.deps.publish).toHaveBeenCalledTimes(1)
  })

  it('publishes the latest text when Start is pressed again mid-connect', async () => {
    const h = harness()
    const connect = deferred<PresenceLink>()

    h.deps.connect.mockImplementationOnce(() => connect.promise)

    const first = h.controller.start(request({ text: 'First' }))
    const second = h.controller.start(request({ text: 'Second' }))

    await vi.waitFor(() => expect(h.deps.connect).toHaveBeenCalled())
    connect.resolve(new FakeLink('conn-1'))

    expect((await first).ok).toBe(true)
    expect((await second).snapshot.text).toBe('Second')
    expect(h.deps.connect).toHaveBeenCalledTimes(1)
  })

  it('does not start while Fortnite is running', async () => {
    const h = harness()

    h.game.running = true

    const result = await h.controller.start(request())

    expect(result.error?.code).toBe('game-running')
    expect(result.snapshot.state).toBe('stopped')
    expect(h.deps.createAuth).not.toHaveBeenCalled()
  })
})

describe('one account at a time', () => {
  it('will not move a session to another account without being told to', async () => {
    const h = harness()

    await h.controller.start(request())
    const result = await h.controller.start(request({ accountId: bob }))

    expect(result.error?.code).toBe('replace-required')
    expect(result.error?.message).toContain('Alice')
    expect(result.snapshot).toMatchObject({ accountId: alice, state: 'active' })
    expect(h.links[0].closed).toBe(0)
  })

  it('closes the first account’s session when replacing it', async () => {
    const h = harness()

    await h.controller.start(request())
    const result = await h.controller.start(
      request({ accountId: bob, replaceActive: true })
    )

    expect(result.ok).toBe(true)
    expect(result.snapshot).toMatchObject({ accountId: bob, state: 'active' })
    expect(h.links[0].closed).toBe(1)
    expect(h.auths[0].dispose).toHaveBeenCalled()
    expect(h.deps.publish.mock.calls[1][0]).toMatchObject({
      accountId: bob,
      connectionId: 'conn-2',
    })
  })

  it('keeps the running session when a replacement is refused', async () => {
    const h = harness()

    await h.controller.start(request())
    h.game.running = true

    const result = await h.controller.start(
      request({ accountId: bob, replaceActive: true })
    )

    expect(result.error?.code).toBe('game-running')
    expect(result.snapshot).toMatchObject({ accountId: alice, state: 'active' })
  })
})

describe('stopping', () => {
  it('stops during sign-in, and the late token opens nothing', async () => {
    const h = harness()
    const token = deferred<string>()

    h.deps.createAuth.mockImplementationOnce(() => {
      const auth = new FakeAuth()
      auth.accessToken.mockImplementationOnce(() => token.promise)
      h.auths.push(auth)
      return auth
    })

    const started = h.controller.start(request())

    await vi.waitFor(() => expect(h.auths[0]?.accessToken).toHaveBeenCalled())
    const stopped = await h.controller.stop()

    token.resolve(secretToken)
    const result = await started
    await vi.runAllTimersAsync()

    expect(stopped.snapshot).toMatchObject({ state: 'stopped', stoppedReason: 'user' })
    expect(result.ok).toBe(false)
    expect(h.deps.connect).not.toHaveBeenCalled()
    expect(h.controller.status().state).toBe('stopped')
  })

  it('stops during connect and closes the socket that arrives late', async () => {
    const h = harness()
    const connect = deferred<PresenceLink>()
    const late = new FakeLink('conn-late')

    h.deps.connect.mockImplementationOnce(() => connect.promise)

    const started = h.controller.start(request())

    await vi.waitFor(() => expect(h.deps.connect).toHaveBeenCalled())
    await h.controller.stop()
    connect.resolve(late)
    await started

    expect(late.closed).toBe(1)
    expect(h.deps.publish).not.toHaveBeenCalled()
    expect(h.controller.status().state).toBe('stopped')
  })

  it('stops during publish, and the late reply does not revive it', async () => {
    const h = harness()
    const publish = deferred<void>()

    h.deps.publish.mockImplementationOnce(() => publish.promise)

    const started = h.controller.start(request())

    await vi.waitFor(() => expect(h.deps.publish).toHaveBeenCalled())
    await h.controller.stop()
    const signal = h.deps.publish.mock.calls[0][0].signal

    publish.resolve()
    await started
    await vi.runAllTimersAsync()

    expect(signal.aborted).toBe(true)
    expect(h.states().slice(-2)).toEqual(['stopping', 'stopped'])
    expect(h.states()).not.toContain('active')
    expect(h.links[0].closed).toBe(1)
  })

  it('stops during a reconnect delay and never reconnects', async () => {
    const h = harness()

    await h.controller.start(request())
    h.links[0].drop()
    expect(h.controller.status().state).toBe('reconnecting')

    await h.controller.stop()
    await vi.advanceTimersByTimeAsync(60 * 60 * 1_000)

    expect(h.deps.connect).toHaveBeenCalledTimes(1)
    expect(h.controller.status().state).toBe('stopped')
  })

  it('stops a session whose start was queued just before the stop', async () => {
    const h = harness()

    const started = h.controller.start(request())
    const stopped = h.controller.stop()

    await Promise.all([started, stopped])
    await vi.runAllTimersAsync()

    expect(h.controller.status().state).toBe('stopped')
    expect(h.links.every((link) => link.closed === 1)).toBe(true)
  })

  it('ignores a link loss that arrives after stopping', async () => {
    const h = harness()

    await h.controller.start(request())
    const link = h.links[0]

    await h.controller.stop()
    link.drop()
    await vi.runAllTimersAsync()

    expect(h.deps.connect).toHaveBeenCalledTimes(1)
    expect(h.controller.status().state).toBe('stopped')
  })

  it('dismisses an error when nothing is running', async () => {
    const h = harness()

    h.deps.publish.mockRejectedValueOnce(httpError(403))
    await h.controller.start(request())
    expect(h.controller.status().state).toBe('error')

    const result = await h.controller.stop()

    expect(result.snapshot).toMatchObject({ state: 'stopped', errorCode: null })
  })
})

describe('updating', () => {
  it('confirms the new status only once Epic accepts it', async () => {
    const h = harness()

    await h.controller.start(request({ text: 'Old' }))

    const publish = deferred<void>()

    h.deps.publish.mockImplementationOnce(() => publish.promise)

    const updated = h.controller.update(request({ text: 'New', availability: 'away' }))

    await vi.waitFor(() => expect(h.deps.publish).toHaveBeenCalledTimes(2))
    expect(h.controller.status()).toMatchObject({
      state: 'active',
      text: 'Old',
      availability: 'online',
      pending: { text: 'New', availability: 'away' },
    })

    publish.resolve()
    const result = await updated

    expect(result.ok).toBe(true)
    expect(result.snapshot).toMatchObject({
      text: 'New',
      availability: 'away',
      pending: null,
    })
  })

  it('keeps the old status after a refusal and never retries the refused one', async () => {
    const h = harness()

    await h.controller.start(request({ text: 'Old' }))
    h.deps.publish.mockRejectedValueOnce(httpError(400))

    const result = await h.controller.update(request({ text: 'Refused' }))

    expect(result.error?.code).toBe('rejected')
    expect(result.snapshot).toMatchObject({
      state: 'active',
      text: 'Old',
      pending: null,
    })
    expect(result.snapshot.errorMessage).toMatch(/previous status is still showing/)

    h.links[0].drop()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(h.deps.publish.mock.calls.at(-1)?.[0].payload).toMatchObject({
      activity: { value: 'Old' },
    })
  })

  it('stops for good when an update finds permission gone', async () => {
    const h = harness()

    await h.controller.start(request({ text: 'Old' }))
    h.deps.publish.mockRejectedValueOnce(httpError(403))

    const result = await h.controller.update(request({ text: 'New' }))
    await vi.runAllTimersAsync()

    expect(result.error?.code).toBe('permission-denied')
    expect(h.controller.status()).toMatchObject({
      state: 'error',
      errorCode: 'permission-denied',
    })
    expect(h.links[0].closed).toBe(1)
    expect(h.deps.connect).toHaveBeenCalledTimes(1)
  })

  it('refuses an update for an account that is not running', async () => {
    const h = harness()

    await h.controller.start(request())
    const result = await h.controller.update(request({ accountId: bob }))

    expect(result.error?.code).toBe('not-running')
    expect(h.deps.publish).toHaveBeenCalledTimes(1)
  })

  it('holds an update made while reconnecting and sends it on the new connection', async () => {
    const h = harness()

    await h.controller.start(request({ text: 'Old' }))
    h.links[0].drop()

    const result = await h.controller.update(request({ text: 'Queued' }))

    expect(result.error?.code).toBe('reconnecting')
    expect(result.snapshot.pending?.text).toBe('Queued')

    await vi.advanceTimersByTimeAsync(5_000)

    expect(h.controller.status()).toMatchObject({ state: 'active', text: 'Queued' })
    expect(h.deps.publish.mock.calls.at(-1)?.[0].connectionId).toBe('conn-2')
  })

  it('retries a publish once with a fresh token after a 401', async () => {
    const h = harness()

    h.deps.publish.mockRejectedValueOnce(httpError(401))

    const result = await h.controller.start(request())

    expect(result.ok).toBe(true)
    expect(h.auths[0].invalidate).toHaveBeenCalledTimes(1)
    expect(h.deps.publish).toHaveBeenCalledTimes(2)
  })
})

describe('reconnecting', () => {
  it('republishes the full status against the new connection id before going Active', async () => {
    const h = harness()

    await h.controller.start(request({ text: 'Away for a bit', availability: 'away' }))
    h.links[0].drop()

    expect(h.controller.status()).toMatchObject({
      state: 'reconnecting',
      text: null,
      pending: { text: 'Away for a bit', availability: 'away' },
      errorCode: 'connection-lost',
    })
    expect(h.controller.status().retryAt).not.toBeNull()

    await vi.advanceTimersByTimeAsync(5_000)

    const last = h.deps.publish.mock.calls.at(-1)?.[0]

    expect(last?.connectionId).toBe('conn-2')
    expect(last?.payload).toMatchObject({
      status: 'away',
      activity: { value: 'Away for a bit' },
    })
    expect(h.controller.status()).toMatchObject({ state: 'active', errorCode: null })
  })

  it('backs off by Retry-After when rate-limited', async () => {
    const h = harness()

    h.deps.connect.mockRejectedValueOnce(
      new PresenceFailure('rate-limited', 'Slow down.', {
        retryable: true,
        retryAfterMs: 60_000,
      })
    )

    const result = await h.controller.start(request())

    expect(result.error?.code).toBe('rate-limited')
    expect(result.snapshot).toMatchObject({
      state: 'reconnecting',
      retryAt: '2026-10-07T12:01:00.000Z',
    })

    await vi.advanceTimersByTimeAsync(59_999)
    expect(h.deps.connect).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(h.deps.connect).toHaveBeenCalledTimes(2)
    expect(h.controller.status().state).toBe('active')
  })

  it('gives up after the attempt limit and says so', async () => {
    const h = harness()

    h.deps.connect.mockRejectedValue(
      new PresenceFailure('network', 'Offline.', { retryable: true })
    )

    await h.controller.start(request())
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1_000)

    expect(h.deps.connect).toHaveBeenCalledTimes(presenceRetry.maxAttempts + 1)
    expect(h.controller.status()).toMatchObject({
      state: 'error',
      errorCode: 'gave-up',
    })
  })

  it('stops for good when sign-in needs the user', async () => {
    const h = harness()

    h.deps.createAuth.mockImplementationOnce(() => {
      const auth = new FakeAuth()
      auth.accessToken.mockRejectedValueOnce(
        new PresenceFailure('reauth-required', 'Sign in again.')
      )
      h.auths.push(auth)
      return auth
    })

    const result = await h.controller.start(request())
    await vi.advanceTimersByTimeAsync(60 * 60 * 1_000)

    expect(result.snapshot).toMatchObject({ state: 'error', errorCode: 'reauth-required' })
    expect(h.deps.connect).not.toHaveBeenCalled()
  })

  it('refreshes the token after a handshake 401', async () => {
    const h = harness()

    h.deps.connect.mockRejectedValueOnce(
      new PresenceFailure('unauthorized', 'No.', { retryable: true, status: 401 })
    )

    await h.controller.start(request())
    expect(h.auths[0].invalidate).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(h.controller.status().state).toBe('active')
  })
})

describe('a reconnect racing a slow publish on the old connection', () => {
  /** A PATCH that hangs until released, but honours its abort signal. */
  function slowPublish(h: ReturnType<typeof harness>) {
    const slow = deferred<void>()

    h.deps.publish.mockImplementationOnce(
      ({ signal }) =>
        new Promise<void>((resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new AxiosError('canceled', 'ERR_CANCELED')),
            { once: true }
          )
          slow.promise.then(resolve, reject)
        })
    )

    return slow
  }

  async function reconnectDuringSlowUpdate() {
    const h = harness()

    await h.controller.start(request({ text: 'One' }))
    slowPublish(h)

    const updating = h.controller.update(request({ text: 'Two' }))

    await vi.waitFor(() => expect(h.deps.publish).toHaveBeenCalledTimes(2))
    h.links[0].drop()
    await vi.advanceTimersByTimeAsync(1_500)
    expect(h.links).toHaveLength(2)

    return { h, updating }
  }

  it('aborts the stale PATCH instead of waiting on it', async () => {
    const { h, updating } = await reconnectDuringSlowUpdate()

    expect(h.deps.publish.mock.calls[1][0].signal.aborted).toBe(true)
    expect((await updating).error?.code).toBe('reconnecting')
    expect(h.controller.status()).toMatchObject({ state: 'active', text: 'Two' })
    expect(h.deps.publish.mock.calls.at(-1)?.[0].connectionId).toBe('conn-2')
  })

  it('closes the new connection when stopped mid-reconnect', async () => {
    const { h, updating } = await reconnectDuringSlowUpdate()

    await h.controller.stop()
    await updating

    expect(h.controller.status().state).toBe('stopped')
    expect(h.links.map((link) => link.closed)).toEqual([1, 1])
  })

  it('notices the new connection dying and only goes Active on a live one', async () => {
    const h = harness()
    const connect = deferred<PresenceLink>()

    await h.controller.start(request({ text: 'One' }))
    h.deps.connect.mockImplementationOnce(() => connect.promise)
    h.links[0].drop()
    await vi.advanceTimersByTimeAsync(1_500)

    // conn-2 is made and dies before anyone could have been listening.
    const doomed = new FakeLink('conn-2')

    h.links.push(doomed)
    connect.resolve(doomed)
    doomed.drop()
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(doomed.closed).toBe(1)
    expect(h.controller.status().state).toBe('active')
    expect(h.deps.publish.mock.calls.at(-1)?.[0].connectionId).toBe('conn-3')
  })
})

describe('sleep', () => {
  it('keeps Epic’s Retry-After across a sleep instead of reconnecting on wake', async () => {
    const h = harness()

    h.deps.publish.mockRejectedValueOnce(httpError(429, { 'retry-after': '600' }))
    expect((await h.controller.start(request())).error?.code).toBe('rate-limited')

    h.controller.suspend()
    h.controller.resume()
    await vi.advanceTimersByTimeAsync(599_000)
    expect(h.deps.connect).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(h.deps.connect).toHaveBeenCalledTimes(2)
    expect(h.controller.status().state).toBe('active')
  })

  it('does not trust a connection that was being opened as the computer slept', async () => {
    const h = harness()
    const connect = deferred<PresenceLink>()
    const beforeSleep = new FakeLink('conn-before-sleep')

    h.deps.connect.mockImplementationOnce(() => connect.promise)

    const started = h.controller.start(request())

    await vi.waitFor(() => expect(h.deps.connect).toHaveBeenCalled())
    h.controller.suspend()
    connect.resolve(beforeSleep)
    await started

    expect(beforeSleep.closed).toBe(1)
    expect(h.deps.publish).not.toHaveBeenCalled()

    h.controller.resume()
    await vi.waitFor(() => expect(h.controller.status().state).toBe('active'))
    expect(h.deps.publish.mock.calls.at(-1)?.[0].connectionId).toBe('conn-1')
  })
})

describe('ending on its own', () => {
  it('stops at the deadline', async () => {
    const h = harness()
    const result = await h.controller.start(request({ durationMinutes: 30 }))

    expect(result.snapshot.expiresAt).toBe('2026-10-07T12:30:00.000Z')

    await vi.advanceTimersByTimeAsync(30 * 60 * 1_000 - 1)
    expect(h.controller.status().state).toBe('active')

    await vi.advanceTimersByTimeAsync(1)
    expect(h.controller.status()).toMatchObject({
      state: 'stopped',
      stoppedReason: 'expired',
    })
    expect(h.links[0].closed).toBe(1)
  })

  it('keeps the deadline absolute across sleep and does not reconnect past it', async () => {
    const h = harness()

    await h.controller.start(request({ durationMinutes: 30 }))
    h.controller.suspend()
    expect(h.links[0].closed).toBe(1)

    vi.setSystemTime(Date.parse('2026-10-07T14:00:00Z'))
    h.controller.resume()
    await vi.runAllTimersAsync()

    expect(h.controller.status()).toMatchObject({
      state: 'stopped',
      stoppedReason: 'expired',
    })
    expect(h.deps.connect).toHaveBeenCalledTimes(1)
  })

  it('reconnects straight away on resume when time remains', async () => {
    const h = harness()

    await h.controller.start(request({ durationMinutes: 120 }))
    h.controller.suspend()
    expect(h.controller.status().state).toBe('reconnecting')

    vi.setSystemTime(Date.parse('2026-10-07T12:30:00Z'))
    h.controller.resume()
    await vi.waitFor(() => expect(h.controller.status().state).toBe('active'))

    expect(h.deps.connect).toHaveBeenCalledTimes(2)
    expect(h.controller.status().expiresAt).toBe('2026-10-07T14:00:00.000Z')
  })

  it('steps aside for Fortnite and does not come back by itself', async () => {
    const h = harness()

    await h.controller.start(request())
    h.game.listener?.(true)
    await vi.runAllTimersAsync()

    expect(h.controller.status()).toMatchObject({
      state: 'stopped',
      stoppedReason: 'game-running',
      accountId: alice,
    })
    expect(h.links[0].closed).toBe(1)

    h.game.running = false
    await vi.advanceTimersByTimeAsync(60 * 60 * 1_000)
    expect(h.deps.connect).toHaveBeenCalledTimes(1)
  })

  it('stops when its account is removed, and only then', async () => {
    const h = harness()

    await h.controller.start(request())
    h.controller.accountRemoved(bob)
    expect(h.controller.status().state).toBe('active')

    h.controller.accountRemoved(alice)
    await vi.runAllTimersAsync()

    expect(h.controller.status()).toMatchObject({
      state: 'stopped',
      stoppedReason: 'account-removed',
    })
    expect(h.auths[0].dispose).toHaveBeenCalled()
  })

  it('forgets an ended session’s account when that account is removed', async () => {
    const h = harness()

    h.deps.publish.mockRejectedValueOnce(httpError(403))
    await h.controller.start(request())
    h.controller.accountRemoved(alice)

    expect(h.controller.status()).toMatchObject({
      state: 'stopped',
      accountId: null,
      displayName: null,
    })
  })

  it('closes its connection on shutdown', async () => {
    const h = harness()

    await h.controller.start(request())
    await h.controller.shutdown()

    expect(h.links[0].closed).toBe(1)
    expect(h.controller.status()).toMatchObject({
      state: 'stopped',
      stoppedReason: 'shutdown',
    })
  })
})

describe('what reaches the renderer', () => {
  it('never carries tokens, connection ids or payload internals', async () => {
    const h = harness()

    await h.controller.start(request({ durationMinutes: 30 }))
    await h.controller.update(request({ text: 'Second', durationMinutes: 30 }))
    h.links[0].drop()
    await vi.advanceTimersByTimeAsync(5_000)
    await h.controller.stop()

    const everything = JSON.stringify(h.emitted)

    expect(h.emitted.length).toBeGreaterThan(4)
    expect(everything).not.toContain(secretToken)
    expect(everything).not.toMatch(/conn-\d/)
    expect(everything).not.toMatch(/EOS_|activity|Bearer/)

    for (const snapshot of h.emitted) {
      expect(Object.keys(snapshot).sort()).toEqual(
        [
          'accountId',
          'availability',
          'displayName',
          'errorCode',
          'errorMessage',
          'expiresAt',
          'lastPublishedAt',
          'pending',
          'retryAt',
          'state',
          'stoppedReason',
          'text',
        ].sort()
      )
    }
  })

  it('logs events without tokens, status text or full account ids', async () => {
    const h = harness()

    await h.controller.start(request({ text: 'Very private status' }))
    h.links[0].drop()
    await vi.advanceTimersByTimeAsync(5_000)
    await h.controller.stop()

    const logged = JSON.stringify(h.deps.log.mock.calls)

    expect(logged).not.toContain(secretToken)
    expect(logged).not.toContain('Very private status')
    expect(logged).not.toContain(alice)
  })
})
