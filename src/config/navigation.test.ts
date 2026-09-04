import { describe, expect, it } from 'vitest'

import {
  activeSectionFor,
  matchesNavPath,
  navDestinations,
  navSections,
  sectionLanding,
  visibleSectionItems,
} from './navigation'
import {
  customizableMenuSettingsRelations,
  isMenuOptionVisible,
} from '../state/settings/customizable-menu'

describe('navigation', () => {
  const destinations = navDestinations()

  it('keeps every automation reachable from the rail', () => {
    // Auto-kick (/stw-operations/automation) is temporarily out of the rail:
    // the party endpoints it relies on no longer work while a match runs.
    expect(destinations).not.toContain('/stw-operations/automation')
    expect(destinations).toContain('/stw-operations/taxi-service')
    expect(destinations).toContain('/stw-operations/auto-llamas')
    expect(destinations).toContain('/stw-operations/urns')
    expect(destinations).toContain('/stw-operations/party')
  })

  it('keeps STW tools and account admin reachable', () => {
    expect(destinations).toContain('/')
    expect(destinations).toContain('/stw-operations/inventory')
    expect(destinations).toContain('/stw-operations/loadouts')
    expect(destinations).toContain('/stw-operations/squads')
    expect(destinations).toContain('/stw-operations/quests')
    expect(destinations).toContain('/stw-operations/shop')
    expect(destinations).toContain('/accounts/add/$type')
    expect(destinations).toContain('/plugins')
  })

  it('badges experimental STW tools as beta', () => {
    const betaItems = navSections.flatMap((section) =>
      section.items.filter((item) => item.beta),
    )

    expect(betaItems.map((item) => item.to)).toEqual([
      '/stw-operations/leaderboards',
      '/stw-operations/outpost',
      '/stw-operations/endurance',
      '/account-management/locker',
      '/account-management/sprites',
    ])
  })

  it('lists every nav item can-key in the customizable menu relations', () => {
    const related = new Set(
      Object.values(customizableMenuSettingsRelations).flat(),
    )
    const itemKeys = navSections.flatMap((section) =>
      section.items.flatMap((item) => [
        ...(item.can ? [item.can] : []),
        ...(item.canAny ?? []),
      ]),
    )

    for (const key of itemKeys) {
      expect(related).toContain(key)
    }
  })
})

describe('isMenuOptionVisible', () => {
  it('defaults to visible when the key has never been saved', () => {
    expect(isMenuOptionVisible({}, 'autoKick')).toBe(true)
  })

  it('hides a tool when its own flag is false', () => {
    expect(isMenuOptionVisible({ taxiService: false }, 'taxiService')).toBe(
      false,
    )
  })

  it('hides a section when every listed child is off', () => {
    const allOff = Object.fromEntries(
      customizableMenuSettingsRelations.stwOperations.map((key) => [
        key,
        false,
      ]),
    )

    expect(isMenuOptionVisible(allOff, 'stwOperations', true)).toBe(false)
  })
})

describe('area navigation', () => {
  const stw = navSections.find((section) => section.key === 'stw')!
  const automate = navSections.find((section) => section.key === 'automate')!
  const account = navSections.find((section) => section.key === 'accounts')!

  it.each([
    ['/', 'home'],
    ['/stw-operations/missions', 'stw'],
    ['/stw-operations/endurance', 'stw'],
    ['/stw-operations/taxi-service', 'automate'],
    ['/accounts/add/device-auth', 'accounts'],
    ['/account-management/profile', 'accounts'],
    ['/account', 'accounts'],
    ['/settings', undefined],
    ['/unrecognized', undefined],
  ])('identifies %s without depending on menu visibility', (path, expected) => {
    expect(activeSectionFor(path)?.key).toBe(expected)
  })

  it('matches whole path segments', () => {
    expect(matchesNavPath('/account-management/profile', '/account')).toBe(
      false,
    )
    expect(matchesNavPath('/settings/tweaks', '/settings')).toBe(true)
    expect(matchesNavPath('/plugins-extra', '/plugins')).toBe(false)
  })

  it('keeps Home visible and places Missions and Endurance in STW', () => {
    expect(
      navSections.find((section) => section.key === 'home')?.can,
    ).toBeUndefined()
    expect(stw.items[0].can).toBe('currentAlerts')
    expect(customizableMenuSettingsRelations.stwOperations).toContain(
      'endurance',
    )
  })

  it('does not populate Automate just because STW tools remain visible', () => {
    expect(
      visibleSectionItems(
        automate,
        (key) =>
          !['taxiService', 'party', 'autoLlamas', 'autoPinUrns'].includes(key),
      ),
    ).toEqual([])
  })

  it('respects a disabled legacy parent after the Missions hierarchy change', () => {
    expect(visibleSectionItems(stw, (key) => key !== 'stwOperations')).toEqual(
      [],
    )
  })

  it('restores the previous page only while it remains visible', () => {
    expect(
      sectionLanding(stw, stw.items, true, '/stw-operations/inventory')?.to,
    ).toBe('/stw-operations/inventory')
    const visible = stw.items.filter((item) => item.can !== 'inventory')
    expect(
      sectionLanding(stw, visible, true, '/stw-operations/inventory')?.to,
    ).toBe('/stw-operations/missions')
  })

  it('does not route to a hidden Missions landing', () => {
    const visible = stw.items.filter((item) => item.can !== 'currentAlerts')
    expect(sectionLanding(stw, visible, true)?.to).toBe(
      '/stw-operations/inventory',
    )
    expect(sectionLanding(stw, [], true)).toBeUndefined()
  })

  it('does not select a disabled account-only destination', () => {
    const outpost = stw.items.filter((item) => item.can === 'outpost')
    expect(sectionLanding(stw, outpost, false)).toBeUndefined()
    expect(sectionLanding(stw, outpost, true)?.to).toBe(
      '/stw-operations/outpost',
    )
  })

  it('keeps the account overview reachable even when all child tools are hidden', () => {
    expect(sectionLanding(account, [], false)).toEqual({ to: '/account' })
  })

  it('preserves concrete parameter values when restoring a visible destination', () => {
    expect(
      sectionLanding(account, account.items, true, '/accounts/add/device-auth'),
    ).toEqual({ to: '/accounts/add/device-auth' })
  })
})
