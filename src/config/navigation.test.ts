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
  /*
   * One destination per thing. The sidebar used to carry Defenders twice
   * (its own page and a vault tab), Backpack and Storage as two entries, and
   * the daily-quest update and reroll as two pages over one component. A second entry for the same thing belongs as a tab, switch or
   * view on the first.
   */
  it('lists every destination and every label once', () => {
    const items = navSections.flatMap((section) => section.items)
    const paths = items.map((item) => item.to)
    const labels = items.map((item) => item.label)
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([])
    expect(labels.filter((label, index) => labels.indexOf(label) !== index)).toEqual([])
  })

  it('keeps merged pages out of the sidebar', () => {
    const paths = navSections.flatMap((section) => section.items.map((item) => item.to))
    for (const merged of ['/stw-operations/inventory', '/stw-operations/storage', '/stw-operations/auto-update-quests']) {
      expect(paths).not.toContain(merged)
    }
  })

  const destinations = navDestinations()

  it('keeps every automation reachable from the rail', () => {
    // Auto-kick (/stw-operations/automation) is temporarily out of the rail:
    // the party endpoints it relies on no longer work while a match runs.
    expect(destinations).not.toContain('/stw-operations/automation')
    expect(destinations).not.toContain('/stw-operations/taxi-service')
    expect(destinations).toContain('/stw-operations/auto-llamas')
    expect(destinations).toContain('/stw-operations/auto-daily-reroll')
    expect(destinations).not.toContain('/stw-operations/auto-update-quests')
    expect(destinations).toContain('/stw-operations/urns')
    expect(destinations).not.toContain('/stw-operations/party')
  })

  it('keeps STW tools and account admin reachable', () => {
    expect(destinations).toContain('/')
    for (const kind of ['schematics', 'heroes', 'defenders', 'survivors']) {
      expect(destinations).toContain(`/stw-operations/${kind}`)
    }
    expect(destinations).toContain('/stw-operations/collection-book')
    expect(destinations).toContain('/stw-operations/rare-item-finder')
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
      '/stw-operations/backpack',
      '/stw-operations/collection-book',
      '/stw-operations/rare-item-finder',
      '/stw-operations/ventures',
      '/stw-operations/outpost',
      '/stw-operations/leaderboards',
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
    expect(isMenuOptionVisible({ autoLlamas: false }, 'autoLlamas')).toBe(
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
    ['/stw-operations/endurance', undefined],
    ['/stw-operations/taxi-service', undefined],
    ['/accounts/add/device-auth', 'accounts'],
    ['/account-management/history', 'accounts'],
    ['/account', 'accounts'],
    ['/settings', undefined],
    ['/unrecognized', undefined],
  ])('identifies %s without depending on menu visibility', (path, expected) => {
    expect(activeSectionFor(path)?.key).toBe(expected)
  })

  it('matches whole path segments', () => {
    expect(matchesNavPath('/account-management/history', '/account')).toBe(
      false,
    )
    expect(matchesNavPath('/settings/tweaks', '/settings')).toBe(true)
    expect(matchesNavPath('/plugins-extra', '/plugins')).toBe(false)
  })

  it('keeps Home and Missions visible and removed tools out of navigation', () => {
    expect(
      navSections.find((section) => section.key === 'home')?.can,
    ).toBeUndefined()
    expect(stw.items[0].can).toBe('currentAlerts')
    expect(navDestinations()).not.toContain('/stw-operations/endurance')
    expect(customizableMenuSettingsRelations.stwOperations).not.toContain(
      'endurance',
    )
  })

  it('does not populate Automate just because STW tools remain visible', () => {
    expect(
      visibleSectionItems(
        automate,
        (key) =>
          !['autoLlamas', 'autoPinUrns', 'autoDailyReroll', 'expeditions'].includes(key),
      ),
    ).toEqual([])
  })

  it('shows Recycled Rewards while either of its source automations is visible', () => {
    const recycled = '/stw-operations/recycled-rewards'
    const visibleWith = (enabled: Array<string>) =>
      visibleSectionItems(automate, (key) =>
        ['stwOperations', ...enabled].includes(key),
      ).map((item) => item.to)

    expect(visibleWith(['autoLlamas'])).toContain(recycled)
    expect(visibleWith(['expeditions'])).toContain(recycled)
    expect(visibleWith(['autoDailyReroll'])).not.toContain(recycled)
  })

  it('respects a disabled legacy parent after the Missions hierarchy change', () => {
    expect(visibleSectionItems(stw, (key) => key !== 'stwOperations')).toEqual(
      [],
    )
  })

  it('restores the previous page only while it remains visible', () => {
    expect(
      sectionLanding(stw, stw.items, true, '/stw-operations/heroes')?.to,
    ).toBe('/stw-operations/heroes')
    const visible = stw.items.filter((item) => item.can !== 'inventory')
    expect(
      sectionLanding(stw, visible, true, '/stw-operations/heroes')?.to,
    ).toBe('/stw-operations/missions')
  })

  it('does not route to a hidden Missions landing', () => {
    const visible = stw.items.filter((item) => item.can !== 'currentAlerts')
    // The commander profile sits right under Missions, so it takes over.
    expect(sectionLanding(stw, visible, true)?.to).toBe(
      '/stw-operations/profile',
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
