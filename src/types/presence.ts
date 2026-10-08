/**
 * Fortnite presence: the friend-facing status Penny can hold up for one
 * linked account while the game itself is closed.
 *
 * Only these shapes cross the IPC boundary. Tokens, connection ids and raw
 * transport frames stay in the main process.
 */

export type PresenceAvailability = 'online' | 'away'

export type PresenceState =
  | 'stopped'
  | 'connecting'
  | 'publishing'
  | 'active'
  | 'reconnecting'
  | 'stopping'
  | 'error'

/** Why the last session ended, when it ended without an error. */
export type PresenceStopReason =
  | 'user'
  | 'expired'
  | 'game-running'
  | 'account-removed'
  | 'replaced'
  | 'shutdown'

export type PresenceErrorCode =
  | 'invalid-request'
  | 'unknown-account'
  | 'replace-required'
  | 'not-running'
  | 'reconnecting'
  | 'game-running'
  | 'reauth-required'
  | 'identity-mismatch'
  | 'permission-denied'
  | 'rejected'
  | 'rate-limited'
  | 'handshake'
  | 'unauthorized'
  | 'connection-lost'
  | 'timeout'
  | 'network'
  | 'server'
  | 'gave-up'
  | 'unknown'

export type PresenceRequest = {
  accountId: string
  text: string
  availability: PresenceAvailability
  /** `null` keeps it up until stopped. */
  durationMinutes: number | null
  /**
   * Start only: another account's session is closed first. Without it, a
   * start for a second account is refused rather than silently moving the
   * session.
   */
  replaceActive?: boolean
}

export type PresenceSnapshot = {
  /** The account the session belongs (or last belonged) to. */
  accountId: string | null
  displayName: string | null
  state: PresenceState
  /** Last text Epic accepted on the current connection. */
  text: string | null
  availability: PresenceAvailability | null
  /** Asked for but not yet accepted: an update in flight, or one waiting for a reconnect. */
  pending: { text: string; availability: PresenceAvailability } | null
  /** ISO timestamps. */
  lastPublishedAt: string | null
  expiresAt: string | null
  /** Next reconnect attempt while `reconnecting`. */
  retryAt: string | null
  stoppedReason: PresenceStopReason | null
  errorCode: PresenceErrorCode | null
  errorMessage: string | null
}

export type PresenceResult = {
  ok: boolean
  error: { code: PresenceErrorCode; message: string } | null
  snapshot: PresenceSnapshot
}
