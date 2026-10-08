import type {
  PresenceErrorCode,
  PresenceRequest,
  PresenceResult,
  PresenceSnapshot,
  PresenceState,
  PresenceStopReason,
} from '../../types/presence'
import type { PresenceTokenSource } from './presence-auth'
import type { PresenceLink } from './presence-transport'

import { parsePresenceRequest } from '../../lib/presence'

import {
  abortedFailure,
  backoffDelay,
  buildPresencePayload,
  failureFromHttp,
  isAborted,
  PresenceFailure,
  presenceRetry,
  type PresenceStatus,
  sameStatus,
  shortAccountId,
} from './presence-model'

/**
 * The one presence session Penny holds, and every way it can end.
 *
 * Rules this class exists to keep:
 *
 * - At most one session, for one account. Starting another account is
 *   refused unless the request says to replace it.
 * - Every async step re-checks that its session is still current before it
 *   opens a socket, publishes, changes state or schedules a retry. Stop and
 *   replacement invalidate synchronously, so a late reply cannot revive a
 *   stopped session.
 * - Active means Epic accepted the status on the current connection, not
 *   that a socket opened. A new connection publishes again before it is
 *   Active.
 * - Desired and confirmed status are kept apart; an update succeeds only
 *   when the new one is accepted.
 * - Expiry is a wall-clock deadline, re-checked after sleep and before every
 *   reconnect.
 * - A running Fortnite wins: the session stops and says why, and does not
 *   come back on its own.
 *
 * Start, update and stop pass through one queue, but it only guards the
 * short set-up and tear-down sections: connecting runs outside it, so Stop
 * is never stuck behind a slow sign-in.
 *
 * No periodic re-publish. The reference re-PATCHes every 30 s; whether Epic
 * needs that is unmeasured, so Penny publishes on start, update and each new
 * connection only. Heartbeats on the socket are separate (transport).
 */

export type PresenceAccount = {
  accountId: string
  displayName: string
}

export type PresenceDeps = {
  now: () => number
  random: () => number
  resolveAccount: (accountId: string) => PresenceAccount | null
  createAuth: (accountId: string) => PresenceTokenSource
  connect: (accessToken: string, signal: AbortSignal) => Promise<PresenceLink>
  publish: (input: {
    accessToken: string
    accountId: string
    connectionId: string
    payload: unknown
    signal: AbortSignal
  }) => Promise<void>
  productVersion: () => Promise<string>
  gameRunning: () => Promise<boolean>
  watchGame: (listener: (running: boolean) => void) => () => void
  emit: (snapshot: PresenceSnapshot) => void
  /** Routine events. Never given tokens, status text or full account ids. */
  log: (event: string, detail?: string) => void
}

type Problem = { code: PresenceErrorCode; message: string }

type Session = {
  generation: number
  account: PresenceAccount
  desired: PresenceStatus
  confirmed: PresenceStatus | null
  expiresAt: number | null
  lastPublishedAt: number | null
  abort: AbortController
  auth: PresenceTokenSource
  link: PresenceLink | null
  /** Aborted when `link` is dropped or replaced: a PATCH aimed at it stops. */
  linkAbort: AbortController | null
  cycling: boolean
  /** Aborted by sleep, so a connect started before it is not trusted after. */
  cycleAbort: AbortController | null
  everActive: boolean
  /** The publish loop, bound to the connection it publishes on. */
  flushing: { link: PresenceLink; run: Promise<void> } | null
  attempts: number
  retryTimer: ReturnType<typeof setTimeout> | null
  retryAt: number | null
  /** Retry-After: no reconnect before this, not even on wake. */
  notBefore: number | null
  expiryTimer: ReturnType<typeof setTimeout> | null
  unwatchGame: (() => void) | null
  problem: Problem | null
  /** Resolves on the first outcome: Active, a retry scheduled, or the end. */
  settled: Promise<void>
  settle: () => void
}

type Ended = {
  generation: number
  account: PresenceAccount | null
  reason: PresenceStopReason | null
  problem: Problem | null
  lastPublishedAt: number | null
}

export class PresenceController {
  private session: Session | null = null
  private ended: Ended | null = null
  private state: PresenceState = 'stopped'
  private generation = 0
  private queue: Promise<unknown> = Promise.resolve()
  private version: Promise<string> | null = null
  private lastEmitted = ''

  constructor(private readonly deps: PresenceDeps) {}

  status(): PresenceSnapshot {
    return this.snapshot()
  }

  async start(input: unknown): Promise<PresenceResult> {
    const parsed = parsePresenceRequest(input)

    if (!parsed.ok) {
      return this.result({ code: 'invalid-request', message: parsed.message })
    }

    const entry = await this.serial(() => this.enterStart(parsed.request))

    if ('problem' in entry) {
      return this.result(entry.problem)
    }

    if (entry.kind === 'update') {
      return this.deliverUpdate(entry.session)
    }

    await entry.session.settled

    return this.outcomeOf(entry.session)
  }

  async update(input: unknown): Promise<PresenceResult> {
    const parsed = parsePresenceRequest(input)

    if (!parsed.ok) {
      return this.result({ code: 'invalid-request', message: parsed.message })
    }

    const session = await this.serial(() => {
      const current = this.session

      if (!current || current.account.accountId !== parsed.request.accountId) {
        return null
      }

      this.apply(current, parsed.request)

      return current
    })

    if (!session) {
      return this.result({
        code: 'not-running',
        message: 'Presence is not running for this account. Start it first.',
      })
    }

    return this.deliverUpdate(session)
  }

  async stop(reason: PresenceStopReason = 'user'): Promise<PresenceResult> {
    const running = this.session

    if (running) {
      // Invalidate now; closing the socket can take a moment.
      this.halt(running, reason, null)
    }

    await this.serial(async () => {
      if (running) {
        await this.release(running)
      }

      // A start queued ahead of this stop may have created a session since.
      const late = this.session

      if (late) {
        this.halt(late, reason, null)
        await this.release(late)
        return
      }

      // Nothing was running: Stop dismisses an error left by the last session.
      if (!running && this.state === 'error') {
        this.ended = this.ended && { ...this.ended, reason, problem: null }
        this.setState('stopped')
      }
    })

    return this.result(null)
  }

  /** The account was unlinked: its session goes, and so does any trace of it. */
  accountRemoved(accountId: string) {
    const session = this.session

    if (session?.account.accountId === accountId) {
      this.stopSession(session, 'account-removed')
      return
    }

    if (this.ended?.account?.accountId === accountId && this.state !== 'stopping') {
      this.ended = null
      this.setState('stopped')
    }
  }

  /** The computer is going to sleep: let the connection go cleanly. */
  suspend() {
    const session = this.session

    if (!session) {
      return
    }

    // Nothing opened before the sleep is trusted after it.
    session.cycleAbort?.abort()
    this.dropLink(session)
    // Also covers a resume event that never arrives: the retry still runs.
    this.scheduleRetry(
      session,
      new PresenceFailure('connection-lost', 'Paused while the computer sleeps.', {
        retryable: true,
      })
    )
  }

  /**
   * Back from sleep: honour the deadline, then reconnect straight away —
   * unless Epic asked Penny to wait, in which case the wait still stands.
   * The attempt count carries on, so sleep cannot make retries endless.
   */
  resume() {
    const session = this.session

    if (!session) {
      return
    }

    if (this.expired(session)) {
      this.stopSession(session, 'expired')
      return
    }

    this.armExpiry(session)

    if (session.link || session.cycling) {
      return
    }

    // Timers drift across sleep; re-arm from the wall clock.
    this.clearRetry(session)

    const wait = (session.notBefore ?? 0) - this.deps.now()

    if (wait > 0) {
      this.armRetry(session, wait)
      this.emit()
      return
    }

    void this.cycle(session)
  }

  /** Launcher quit. Bounded by the link's close grace. */
  async shutdown() {
    const session = this.session

    if (!session) {
      return
    }

    this.halt(session, 'shutdown', null)
    await this.release(session)
  }

  // ── Start / update ───────────────────────────────────────────

  private async enterStart(
    request: PresenceRequest
  ): Promise<
    | { kind: 'start' | 'update'; session: Session }
    | { problem: Problem }
  > {
    const current = this.session

    // Same account: a repeat Start is an update, never a second socket.
    if (current && current.account.accountId === request.accountId) {
      this.apply(current, request)
      return { kind: 'update', session: current }
    }

    if (current && !request.replaceActive) {
      return {
        problem: {
          code: 'replace-required',
          message: `Presence is running for ${current.account.displayName}. Stop it first, or replace it.`,
        },
      }
    }

    // Both checks come before replacing, so a refused start leaves the
    // running session alone.
    if (await this.deps.gameRunning().catch(() => false)) {
      return {
        problem: {
          code: 'game-running',
          message:
            'Fortnite is running, so it is already showing your presence. Start this after you close the game.',
        },
      }
    }

    const account = this.deps.resolveAccount(request.accountId)

    if (!account) {
      return {
        problem: {
          code: 'unknown-account',
          message: 'That account is not linked to Penny any more.',
        },
      }
    }

    if (current) {
      this.halt(current, 'replaced', null)
      await this.release(current)
    }

    const session = this.create(account, request)

    void this.cycle(session)

    return { kind: 'start', session }
  }

  private create(account: PresenceAccount, request: PresenceRequest) {
    let settle = () => {}
    const settled = new Promise<void>((resolve) => {
      settle = resolve
    })

    this.generation += 1

    const session: Session = {
      generation: this.generation,
      account,
      desired: { text: request.text, availability: request.availability },
      confirmed: null,
      expiresAt: null,
      lastPublishedAt: null,
      abort: new AbortController(),
      auth: this.deps.createAuth(account.accountId),
      link: null,
      linkAbort: null,
      cycling: false,
      cycleAbort: null,
      everActive: false,
      flushing: null,
      attempts: 0,
      retryTimer: null,
      retryAt: null,
      notBefore: null,
      expiryTimer: null,
      unwatchGame: null,
      problem: null,
      settled,
      settle,
    }

    this.session = session
    this.ended = null
    this.apply(session, request)
    session.unwatchGame = this.deps.watchGame((running) => {
      if (running) {
        this.stopSession(session, 'game-running')
      }
    })
    this.deps.log('start', shortAccountId(account.accountId))

    return session
  }

  private apply(session: Session, request: PresenceRequest) {
    session.desired = { text: request.text, availability: request.availability }
    session.expiresAt =
      request.durationMinutes === null
        ? null
        : this.deps.now() + request.durationMinutes * 60_000
    this.armExpiry(session)
  }

  /**
   * Publishes the desired status on the live connection and reports whether
   * Epic took it. Before the first connection it waits for that instead.
   */
  private async deliverUpdate(session: Session): Promise<PresenceResult> {
    const target = { ...session.desired }

    this.emit()

    if (!session.everActive) {
      await session.settled
      return this.outcomeOf(session, target)
    }

    if (!session.link || session.cycling) {
      return this.result({
        code: 'reconnecting',
        message:
          'Penny is reconnecting; the new status goes out as soon as it is back.',
      })
    }

    const link = session.link

    try {
      await this.flush(session)
    } catch (error) {
      const failure = toFailure(error, 'publish')

      if (!this.isCurrent(session) || isAborted(failure)) {
        return this.result({
          code: 'not-running',
          message: 'Presence stopped before the update went out.',
        })
      }

      if (failure.code === 'connection-lost') {
        // Only this connection's own failure is acted on here; if it was
        // already lost or replaced, whoever did that owns the retry.
        if (session.link === link) {
          this.connectionFailed(session, failure)
        }

        return this.result({
          code: 'reconnecting',
          message:
            'The connection dropped. Penny is reconnecting and will publish the new status then.',
        })
      }

      // Sign-in or permission is gone: nothing more will publish.
      if (
        failure.code === 'reauth-required' ||
        failure.code === 'permission-denied' ||
        failure.code === 'identity-mismatch'
      ) {
        this.terminate(session, { code: failure.code, message: failure.message })
        return this.result({ code: failure.code, message: failure.message })
      }

      // Epic refused this status: keep showing the old one, and do not let a
      // later reconnect try the refused one again — unless a newer update
      // has replaced it meanwhile.
      if (
        !failure.retryable &&
        session.confirmed &&
        sameStatus(session.desired, target)
      ) {
        session.desired = { ...session.confirmed }
      }

      session.problem = {
        code: failure.code === 'aborted' ? 'unknown' : failure.code,
        message: `${failure.message} Your previous status is still showing.`,
      }
      this.emit()

      return this.result(session.problem)
    }

    return this.outcomeOf(session, target)
  }

  private outcomeOf(session: Session, target?: PresenceStatus): PresenceResult {
    if (this.session === session) {
      if (
        this.state === 'active' &&
        (!target || sameStatus(session.confirmed, target))
      ) {
        return this.result(null)
      }

      return this.result(
        session.problem ?? {
          code: 'reconnecting',
          message: 'Penny is still connecting.',
        }
      )
    }

    if (this.ended?.generation === session.generation && this.ended.problem) {
      return this.result(this.ended.problem)
    }

    return this.result({
      code: 'not-running',
      message: 'Presence stopped before the status went out.',
    })
  }

  // ── Connection cycle ─────────────────────────────────────────

  private async cycle(session: Session) {
    if (!this.isCurrent(session) || session.cycling) {
      return
    }

    const cycleAbort = new AbortController()
    const signal = AbortSignal.any([session.abort.signal, cycleAbort.signal])

    session.cycling = true
    session.cycleAbort = cycleAbort
    session.notBefore = null
    this.clearRetry(session)

    try {
      if (this.expired(session)) {
        this.stopSession(session, 'expired')
        return
      }

      this.setState(session.everActive || session.attempts > 0 ? 'reconnecting' : 'connecting')

      const token = await session.auth.accessToken(signal)

      if (signal.aborted) {
        throw abortedFailure()
      }

      const link = await this.deps.connect(token, signal)

      if (!this.isCurrent(session) || signal.aborted) {
        void link.close()
        return
      }

      // Owned from this moment: Stop closes it and a loss is heard, even
      // while a publish on the old connection is still failing.
      this.adoptLink(session, link)

      this.setState('publishing')
      await this.flush(session)
      this.assertCurrent(session)

      if (session.link !== link) {
        throw lostDuringPublish()
      }

      session.attempts = 0
      session.everActive = true
      session.problem = null
      this.clearRetry(session)
      this.setState('active')
      this.deps.log('active', shortAccountId(session.account.accountId))
      session.settle()
    } catch (error) {
      if (!this.isCurrent(session) || isAborted(error)) {
        return
      }

      this.connectionFailed(session, toFailure(error, 'connect'))
    } finally {
      session.cycling = false

      if (session.cycleAbort === cycleAbort) {
        session.cycleAbort = null
      }
    }
  }

  /**
   * Publishes until Epic has accepted whatever is desired now. Concurrent
   * callers share one loop, which picks up the latest desired status.
   */
  private flush(session: Session): Promise<void> {
    const link = session.link
    const linkAbort = session.linkAbort

    if (!link || !linkAbort) {
      return Promise.reject(lostDuringPublish())
    }

    // A loop still publishing on a replaced connection is already doomed.
    if (session.flushing?.link === link) {
      return session.flushing.run
    }

    const run = (async () => {
      while (
        this.isCurrent(session) &&
        !sameStatus(session.desired, session.confirmed)
      ) {
        if (session.link !== link) {
          throw lostDuringPublish()
        }

        const target = { ...session.desired }

        try {
          await this.publishOnce(session, link, linkAbort.signal, target)
        } catch (error) {
          this.assertCurrent(session)

          // Cut short because this connection went away, not a refusal.
          if (session.link !== link) {
            throw lostDuringPublish()
          }

          throw error
        }

        this.assertCurrent(session)

        if (session.link !== link) {
          throw lostDuringPublish()
        }

        session.confirmed = target
        session.lastPublishedAt = this.deps.now()
        session.problem = null
        this.deps.log('published', shortAccountId(session.account.accountId))
        this.emit()
      }

      this.assertCurrent(session)
    })()

    session.flushing = { link, run }
    void run
      .catch(() => undefined)
      .finally(() => {
        if (session.flushing?.run === run) {
          session.flushing = null
        }
      })

    return run
  }

  private async publishOnce(
    session: Session,
    link: PresenceLink,
    linkSignal: AbortSignal,
    target: PresenceStatus
  ) {
    const payload = buildPresencePayload(target, await this.productVersion())
    const signal = AbortSignal.any([session.abort.signal, linkSignal])

    // One retry with a fresh token if Epic says the old one is no good.
    for (let attempt = 0; ; attempt += 1) {
      const accessToken = await session.auth.accessToken(session.abort.signal)

      this.assertCurrent(session)

      try {
        await this.deps.publish({
          accessToken,
          accountId: session.account.accountId,
          connectionId: link.connectionId,
          payload,
          signal,
        })

        return
      } catch (error) {
        const failure = failureFromHttp(error, 'publish')

        if (failure.code === 'unauthorized' && attempt === 0) {
          session.auth.invalidate()
          continue
        }

        throw failure
      }
    }
  }

  private linkLost(session: Session, link: PresenceLink, failure: PresenceFailure) {
    if (!this.isCurrent(session) || session.link !== link) {
      return
    }

    this.dropLink(session)
    this.deps.log('link-lost', failure.code)

    // A cycle in progress sees the missing link and handles the retry.
    if (session.cycling) {
      return
    }

    if (this.expired(session)) {
      this.stopSession(session, 'expired')
      return
    }

    this.scheduleRetry(session, failure)
  }

  private connectionFailed(session: Session, failure: PresenceFailure) {
    if (failure.code === 'unauthorized') {
      session.auth.invalidate()
    }

    this.dropLink(session)
    this.deps.log(
      'failed',
      `${failure.code}${failure.status ? ` ${failure.status}` : ''}`
    )

    if (!failure.retryable || failure.code === 'aborted') {
      this.terminate(session, {
        code: failure.code === 'aborted' ? 'unknown' : failure.code,
        message: failure.message,
      })
      return
    }

    this.scheduleRetry(session, failure)
  }

  private scheduleRetry(session: Session, failure: PresenceFailure) {
    if (!this.isCurrent(session) || session.retryTimer) {
      return
    }

    session.attempts += 1

    if (session.attempts > presenceRetry.maxAttempts) {
      this.terminate(session, {
        code: 'gave-up',
        message: `Could not reconnect after ${presenceRetry.maxAttempts} tries. ${failure.message}`,
      })
      return
    }

    const delay = backoffDelay(
      session.attempts,
      this.deps.random,
      failure.retryAfterMs
    )

    session.notBefore =
      failure.retryAfterMs === null ? null : this.deps.now() + delay
    session.problem = {
      code: failure.code === 'aborted' ? 'unknown' : failure.code,
      message: failure.message,
    }
    this.armRetry(session, delay)
    this.setState('reconnecting')
    session.settle()
  }

  // ── Ending ───────────────────────────────────────────────────

  /** Stop for a reason that is not a button press (expiry, game, removal). */
  private stopSession(session: Session, reason: PresenceStopReason) {
    if (!this.isCurrent(session)) {
      return
    }

    this.halt(session, reason, null)
    void this.serial(() => this.release(session))
  }

  /** Stop with an error the user has to act on. */
  private terminate(session: Session, problem: Problem) {
    if (!this.isCurrent(session)) {
      return
    }

    this.halt(session, null, problem)
    void this.serial(() => this.release(session))
  }

  /**
   * Synchronous half of ending a session: nothing it started can act after
   * this returns.
   */
  private halt(
    session: Session,
    reason: PresenceStopReason | null,
    problem: Problem | null
  ) {
    if (this.session !== session) {
      return
    }

    this.session = null
    this.generation += 1
    session.abort.abort()
    this.clearRetry(session)

    if (session.expiryTimer) {
      clearTimeout(session.expiryTimer)
      session.expiryTimer = null
    }

    session.unwatchGame?.()
    session.unwatchGame = null

    this.ended = {
      generation: session.generation,
      account: session.account,
      reason,
      problem,
      lastPublishedAt: session.lastPublishedAt,
    }
    this.deps.log(
      'stop',
      `${shortAccountId(session.account.accountId)} ${reason ?? problem?.code ?? ''}`.trim()
    )
    this.setState(problem ? 'error' : 'stopping')
    session.settle()
  }

  /** Asynchronous half: close what the session owned. Bounded by the link. */
  private async release(session: Session) {
    const link = session.link

    session.link = null
    session.linkAbort?.abort()
    session.linkAbort = null
    session.auth.dispose()

    if (link) {
      await link.close().catch(() => undefined)
    }

    if (
      this.session === null &&
      this.ended?.generation === session.generation &&
      this.state === 'stopping'
    ) {
      this.setState('stopped')
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private adoptLink(session: Session, link: PresenceLink) {
    this.dropLink(session)
    session.link = link
    session.linkAbort = new AbortController()
    // A new connection id has nothing published on it yet.
    session.confirmed = null
    link.onLost((failure) => this.linkLost(session, link, failure))
  }

  private dropLink(session: Session) {
    const link = session.link

    session.link = null
    session.confirmed = null
    session.linkAbort?.abort()
    session.linkAbort = null

    if (link) {
      void link.close()
    }
  }

  private armRetry(session: Session, delay: number) {
    session.retryAt = this.deps.now() + delay
    session.retryTimer = setTimeout(() => {
      session.retryTimer = null
      void this.cycle(session)
    }, delay)
  }

  private clearRetry(session: Session) {
    if (session.retryTimer) {
      clearTimeout(session.retryTimer)
      session.retryTimer = null
    }

    session.retryAt = null
  }

  private armExpiry(session: Session) {
    if (session.expiryTimer) {
      clearTimeout(session.expiryTimer)
      session.expiryTimer = null
    }

    if (session.expiresAt === null || !this.isCurrent(session)) {
      return
    }

    const remaining = session.expiresAt - this.deps.now()

    if (remaining <= 0) {
      this.stopSession(session, 'expired')
      return
    }

    // Timers run late across sleep, never early; the deadline is re-read.
    session.expiryTimer = setTimeout(
      () => {
        session.expiryTimer = null

        if (this.expired(session)) {
          this.stopSession(session, 'expired')
        } else {
          this.armExpiry(session)
        }
      },
      Math.min(remaining, 2 ** 31 - 1)
    )
  }

  private expired(session: Session) {
    return session.expiresAt !== null && this.deps.now() >= session.expiresAt
  }

  private isCurrent(session: Session) {
    return (
      this.session === session &&
      session.generation === this.generation &&
      !session.abort.signal.aborted
    )
  }

  private assertCurrent(session: Session) {
    if (!this.isCurrent(session)) {
      throw abortedFailure()
    }
  }

  private productVersion() {
    if (!this.version) {
      const version = this.deps.productVersion()

      this.version = version
      // A failed lookup is retried next time rather than cached.
      void version.catch(() => {
        if (this.version === version) {
          this.version = null
        }
      })
    }

    return this.version
  }

  private serial<T>(task: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)

    this.queue = run.catch(() => undefined)

    return run
  }

  private setState(state: PresenceState) {
    this.state = state
    this.emit()
  }

  private emit() {
    const snapshot = this.snapshot()
    const serialized = JSON.stringify(snapshot)

    if (serialized === this.lastEmitted) {
      return
    }

    this.lastEmitted = serialized
    this.deps.emit(snapshot)
  }

  private result(problem: Problem | null): PresenceResult {
    return { ok: problem === null, error: problem, snapshot: this.snapshot() }
  }

  /**
   * Built field by field from known values, so nothing that reaches the
   * renderer can carry a token or a transport object along with it.
   */
  private snapshot(): PresenceSnapshot {
    const session = this.session

    if (session) {
      return {
        accountId: session.account.accountId,
        displayName: session.account.displayName,
        state: this.state,
        text: session.confirmed?.text ?? null,
        availability: session.confirmed?.availability ?? null,
        pending: sameStatus(session.desired, session.confirmed)
          ? null
          : {
              text: session.desired.text,
              availability: session.desired.availability,
            },
        lastPublishedAt: iso(session.lastPublishedAt),
        expiresAt: iso(session.expiresAt),
        retryAt: this.state === 'reconnecting' ? iso(session.retryAt) : null,
        stoppedReason: null,
        errorCode: session.problem?.code ?? null,
        errorMessage: session.problem?.message ?? null,
      }
    }

    const ended = this.ended

    return {
      accountId: ended?.account?.accountId ?? null,
      displayName: ended?.account?.displayName ?? null,
      state: this.state,
      text: null,
      availability: null,
      pending: null,
      lastPublishedAt: iso(ended?.lastPublishedAt ?? null),
      expiresAt: null,
      retryAt: null,
      stoppedReason: ended?.reason ?? null,
      errorCode: ended?.problem?.code ?? null,
      errorMessage: ended?.problem?.message ?? null,
    }
  }
}

function iso(value: number | null) {
  return value === null ? null : new Date(value).toISOString()
}

function lostDuringPublish() {
  return new PresenceFailure(
    'connection-lost',
    "The connection to Epic's presence service dropped before the status went out.",
    { retryable: true }
  )
}

function toFailure(error: unknown, stage: 'connect' | 'publish') {
  return error instanceof PresenceFailure ? error : failureFromHttp(error, stage)
}
