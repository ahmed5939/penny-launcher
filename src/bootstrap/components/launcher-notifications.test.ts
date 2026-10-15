import { describe, expect, it } from 'vitest'

import type { AccountData } from '../../types/accounts'

import { launcherNotificationMessage } from './launcher-notifications'

const account = { accountId: 'account-1', displayName: 'Ahmed' } as AccountData
const t = (key: string, { name }: { name: string }) => `${key} (${name})`

describe('launcherNotificationMessage', () => {
  it('confirms a launch', () => {
    expect(launcherNotificationMessage({ account, status: true }, t)).toBe(
      'launch-game.notifications.success (Ahmed)'
    )
  })

  it('points at the install when the launcher is missing', () => {
    expect(
      launcherNotificationMessage({ account, status: false, reason: 'missing-install' }, t)
    ).toBe('launch-game.notifications.missing (Ahmed)')
  })

  it('asks for the account to be re-added when the sign-in has expired', () => {
    expect(
      launcherNotificationMessage({ account, status: false, reason: 'signed-out' }, t)
    ).toBe(
      'Could not launch with Ahmed: its sign-in has expired. Re-add the account, then launch again.'
    )
  })

  it('keeps the generic error for anything else', () => {
    expect(launcherNotificationMessage({ account, status: false }, t)).toBe(
      'launch-game.notifications.error (Ahmed)'
    )
  })
})
