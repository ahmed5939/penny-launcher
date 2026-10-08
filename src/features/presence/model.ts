import type { StatusTone } from '../../components/page'
import type {
  PresenceSnapshot,
  PresenceStopReason,
} from '../../types/presence'

/**
 * What the Presence page and the status bar say about a snapshot. Pure, so
 * every state can be checked without a window.
 */

export type PresencePhase = {
  label: string
  tone: StatusTone
  /** Only for states that are genuinely live right now. */
  pulse: boolean
}

export function presencePhase(snapshot: PresenceSnapshot): PresencePhase {
  switch (snapshot.state) {
    case 'connecting':
      return { label: 'Connecting', tone: 'warning', pulse: true }
    case 'publishing':
      return { label: 'Publishing', tone: 'warning', pulse: true }
    case 'active':
      return { label: 'Active', tone: 'active', pulse: true }
    case 'reconnecting':
      return { label: 'Reconnecting', tone: 'warning', pulse: false }
    case 'stopping':
      return { label: 'Stopping', tone: 'idle', pulse: false }
    case 'error':
      return { label: 'Error', tone: 'danger', pulse: false }
    case 'stopped':
      return snapshot.stoppedReason === 'game-running'
        ? { label: 'Stepped aside', tone: 'idle', pulse: false }
        : { label: 'Stopped', tone: 'idle', pulse: false }
  }
}

/** A session exists in the main process (it may be retrying). */
export function isPresenceLive(snapshot: PresenceSnapshot) {
  return (
    snapshot.state === 'connecting' ||
    snapshot.state === 'publishing' ||
    snapshot.state === 'active' ||
    snapshot.state === 'reconnecting'
  )
}

/** Worth a place in the status bar: running, ending, or needing attention. */
export function isPresenceVisible(snapshot: PresenceSnapshot) {
  return (
    isPresenceLive(snapshot) ||
    snapshot.state === 'stopping' ||
    snapshot.state === 'error' ||
    (snapshot.state === 'stopped' && snapshot.stoppedReason === 'game-running')
  )
}

export function stopReasonText(reason: PresenceStopReason | null) {
  switch (reason) {
    case 'expired':
      return 'The time you set ran out.'
    case 'game-running':
      return 'Fortnite started, so Penny stepped aside and the game shows your presence. Start again after you close it.'
    case 'replaced':
      return 'Replaced by another account.'
    case 'account-removed':
      return 'The account was removed from Penny.'
    case 'shutdown':
      return 'Penny was closed.'
    case 'user':
    case null:
      return null
  }
}

export type PresenceAction =
  /** Nothing running: start for the selected account. */
  | { kind: 'start' }
  /** Running for the selected account: publish the form. */
  | { kind: 'update' }
  /** Running for another account: starting means replacing it. */
  | { kind: 'replace'; activeName: string }

export function presenceAction(
  snapshot: PresenceSnapshot,
  selectedAccountId: string | null
): PresenceAction {
  if (!isPresenceLive(snapshot) || !snapshot.accountId) {
    return { kind: 'start' }
  }

  return snapshot.accountId === selectedAccountId
    ? { kind: 'update' }
    : { kind: 'replace', activeName: snapshot.displayName ?? 'another account' }
}

/** Errors the existing sign-in flow fixes. */
export function needsSignIn(snapshot: PresenceSnapshot) {
  return snapshot.errorCode === 'reauth-required'
}

export function clockTime(iso: string | null, now = Date.now()) {
  if (!iso) {
    return null
  }

  const date = new Date(iso)
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return new Date(now).toDateString() === date.toDateString()
    ? time
    : `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
}

export function availabilityLabel(availability: 'online' | 'away' | null) {
  return availability === 'away' ? 'Away' : 'Online'
}
