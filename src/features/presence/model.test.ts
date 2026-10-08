import type { PresenceSnapshot } from '../../types/presence'

import { describe, expect, it } from 'vitest'

import { emptyPresenceSnapshot } from '../../state/accounts/presence'

import {
  isPresenceLive,
  isPresenceVisible,
  needsSignIn,
  presenceAction,
  presencePhase,
  stopReasonText,
} from './model'

const alice = 'a'.repeat(32)
const bob = 'b'.repeat(32)

const snapshot = (overrides: Partial<PresenceSnapshot>): PresenceSnapshot => ({
  ...emptyPresenceSnapshot,
  ...overrides,
})

describe('presencePhase', () => {
  it('names every state, and only pulses what is live', () => {
    expect(presencePhase(snapshot({ state: 'connecting' }))).toMatchObject({ label: 'Connecting', pulse: true })
    expect(presencePhase(snapshot({ state: 'publishing' }))).toMatchObject({ label: 'Publishing', pulse: true })
    expect(presencePhase(snapshot({ state: 'active' }))).toEqual({ label: 'Active', tone: 'active', pulse: true })
    expect(presencePhase(snapshot({ state: 'reconnecting' }))).toMatchObject({ label: 'Reconnecting', tone: 'warning', pulse: false })
    expect(presencePhase(snapshot({ state: 'stopping' }))).toMatchObject({ label: 'Stopping', pulse: false })
    expect(presencePhase(snapshot({ state: 'error' }))).toMatchObject({ label: 'Error', tone: 'danger' })
    expect(presencePhase(snapshot({ state: 'stopped' }))).toMatchObject({ label: 'Stopped', tone: 'idle' })
    expect(
      presencePhase(snapshot({ state: 'stopped', stoppedReason: 'game-running' }))
    ).toMatchObject({ label: 'Stepped aside' })
  })
})

describe('visibility', () => {
  it('keeps running and attention states in the status bar', () => {
    expect(isPresenceVisible(snapshot({ state: 'stopped' }))).toBe(false)
    expect(isPresenceVisible(snapshot({ state: 'stopped', stoppedReason: 'expired' }))).toBe(false)
    expect(isPresenceVisible(snapshot({ state: 'stopped', stoppedReason: 'game-running' }))).toBe(true)
    expect(isPresenceVisible(snapshot({ state: 'reconnecting' }))).toBe(true)
    expect(isPresenceVisible(snapshot({ state: 'error' }))).toBe(true)
    expect(isPresenceLive(snapshot({ state: 'error' }))).toBe(false)
  })
})

describe('presenceAction', () => {
  it('starts when nothing runs', () => {
    expect(presenceAction(snapshot({}), alice)).toEqual({ kind: 'start' })
    expect(
      presenceAction(snapshot({ state: 'error', accountId: bob }), alice)
    ).toEqual({ kind: 'start' })
  })

  it('updates the running account', () => {
    expect(
      presenceAction(snapshot({ state: 'active', accountId: alice }), alice)
    ).toEqual({ kind: 'update' })
  })

  it('never silently moves a session to the account in the title bar', () => {
    expect(
      presenceAction(
        snapshot({ state: 'reconnecting', accountId: bob, displayName: 'Bob' }),
        alice
      )
    ).toEqual({ kind: 'replace', activeName: 'Bob' })
  })
})

describe('copy', () => {
  it('explains why a session ended without claiming the account is offline', () => {
    expect(stopReasonText('game-running')).toMatch(/stepped aside/)
    expect(stopReasonText('expired')).toMatch(/ran out/)
    expect(stopReasonText('user')).toBeNull()

    for (const reason of ['expired', 'game-running', 'replaced', 'account-removed', 'shutdown'] as const) {
      expect(stopReasonText(reason)).not.toMatch(/offline|invisible/i)
    }
  })

  it('offers sign-in only for a sign-in problem', () => {
    expect(needsSignIn(snapshot({ errorCode: 'reauth-required' }))).toBe(true)
    expect(needsSignIn(snapshot({ errorCode: 'permission-denied' }))).toBe(false)
  })
})
