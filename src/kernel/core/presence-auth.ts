import type { EasTokenResponse } from '../../services/endpoints/presence'

import {
  abortedFailure,
  failureFromHttp,
  PresenceFailure,
} from './presence-model'

/**
 * Presence's own Epic Account Services token, one per session.
 *
 * The chain (after fnapi-js `userEasToken`, pinned in presence-model.ts):
 * Penny's existing account token → exchange code → a Fortnite Android
 * game-client token that belongs to presence alone → its refresh token
 * traded at `/epic/oauth/v2/token` for an EAS user token with the
 * `presence` scope. After that the EAS token renews itself with its own
 * refresh token, and the chain only re-runs when that is refused.
 *
 * Nothing here is written to disk, sent to the renderer, or revoked: Stop
 * forgets the tokens, and the sessions behind them lapse on Epic's side.
 * Penny's account token is only read, so the rest of the app is unaffected.
 */

export type PresenceTokenSource = {
  /** A token valid for at least `presenceAuthMarginMs`. */
  accessToken(signal: AbortSignal): Promise<string>
  /** Forget the access token, e.g. after a 401; the next call renews. */
  invalidate(): void
  /** Cancel any renewal and forget everything. */
  dispose(): void
}

export type PresenceAuthDeps = {
  now: () => number
  /**
   * A refresh token for the Android game client, owned by presence. Must
   * fail with `reauth-required` when the account's own sign-in is gone and
   * `identity-mismatch` when Epic answers for another account.
   */
  mintGameRefreshToken: (
    accountId: string,
    signal: AbortSignal
  ) => Promise<string>
  requestEasToken: (
    refreshToken: string,
    signal: AbortSignal
  ) => Promise<EasTokenResponse>
}

/** Renew this long before expiry, so a token never dies mid-request. */
export const presenceAuthMarginMs = 2 * 60 * 1_000

type HeldToken = {
  accessToken: string
  accessExpiresAt: number
  refreshToken: string | null
  refreshExpiresAt: number | null
}

export class PresenceAuth implements PresenceTokenSource {
  private held: HeldToken | null = null
  private renewal: Promise<string> | null = null
  private controller = new AbortController()
  private disposed = false

  constructor(
    private readonly accountId: string,
    private readonly deps: PresenceAuthDeps
  ) {}

  accessToken(signal: AbortSignal): Promise<string> {
    if (this.disposed || signal.aborted) {
      return Promise.reject(abortedFailure())
    }

    const now = this.deps.now()

    if (this.held && this.held.accessExpiresAt - now > presenceAuthMarginMs) {
      return Promise.resolve(this.held.accessToken)
    }

    // One renewal at a time; every caller waits on the same one.
    if (!this.renewal) {
      const renewal = this.renew(this.controller.signal)

      this.renewal = renewal
      void renewal
        .catch(() => undefined)
        .finally(() => {
          if (this.renewal === renewal) {
            this.renewal = null
          }
        })
    }

    return untilAborted(this.renewal, signal)
  }

  invalidate() {
    if (this.held) {
      this.held = { ...this.held, accessExpiresAt: 0 }
    }
  }

  dispose() {
    this.disposed = true
    this.controller.abort()
    this.held = null
    this.renewal = null
  }

  private async renew(signal: AbortSignal): Promise<string> {
    const refresh = this.held?.refreshToken
    const refreshUsable =
      refresh &&
      (this.held?.refreshExpiresAt === null ||
        (this.held?.refreshExpiresAt ?? 0) - this.deps.now() >
          presenceAuthMarginMs)

    if (refresh && refreshUsable) {
      try {
        return this.accept(await this.deps.requestEasToken(refresh, signal))
      } catch (error) {
        const failure = failureFromHttp(error, 'auth')

        // A refused refresh token means start the chain over; anything else
        // (network, Epic down, stopped) is not fixed by doing more requests.
        if (failure.code !== 'reauth-required') {
          throw failure
        }

        this.held = null
      }
    }

    this.held = null

    let gameRefreshToken: string

    try {
      gameRefreshToken = await this.deps.mintGameRefreshToken(
        this.accountId,
        signal
      )
    } catch (error) {
      throw failureFromHttp(error, 'auth')
    }

    if (signal.aborted) {
      throw abortedFailure()
    }

    try {
      return this.accept(
        await this.deps.requestEasToken(gameRefreshToken, signal)
      )
    } catch (error) {
      throw failureFromHttp(error, 'auth')
    }
  }

  private accept(token: EasTokenResponse) {
    if (this.disposed) {
      throw abortedFailure()
    }

    if (!token || typeof token.access_token !== 'string' || !token.access_token) {
      throw new PresenceFailure(
        'rejected',
        'Epic answered the presence sign-in without a token.'
      )
    }

    // Fail closed: a token that cannot be shown to be this account's is not
    // used, even if Epic simply left the field out.
    if (token.account_id?.toLowerCase() !== this.accountId.toLowerCase()) {
      throw new PresenceFailure(
        'identity-mismatch',
        'Epic signed presence in as a different account than the one selected. Nothing was published.'
      )
    }

    const now = this.deps.now()

    this.held = {
      accessToken: token.access_token,
      accessExpiresAt: expiryOf(token.expires_at, token.expires_in, now) ?? now,
      refreshToken:
        typeof token.refresh_token === 'string' && token.refresh_token
          ? token.refresh_token
          : null,
      refreshExpiresAt: expiryOf(
        token.refresh_expires_at,
        token.refresh_expires_in,
        now
      ),
    }

    return token.access_token
  }
}

function expiryOf(
  at: string | undefined,
  inSeconds: number | undefined,
  now: number
): number | null {
  const parsed = at ? Date.parse(at) : Number.NaN

  if (Number.isFinite(parsed)) {
    return parsed
  }

  return typeof inSeconds === 'number' && Number.isFinite(inSeconds)
    ? now + inSeconds * 1_000
    : null
}

/** The shared renewal keeps going; only this caller stops waiting. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortedFailure())

    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}
