import { describe, expect, it } from 'vitest'

import { navDestinations, navSections } from './navigation'
import {
  customizableMenuSettingsRelations,
  isMenuOptionVisible,
} from '../state/settings/customizable-menu'

describe('navigation', () => {
  const destinations = navDestinations()

  it('keeps every automation reachable from the rail', () => {
    expect(destinations).toContain('/stw-operations/automation')
    expect(destinations).toContain('/stw-operations/taxi-service')
    expect(destinations).toContain('/stw-operations/auto-llamas')
    expect(destinations).toContain('/stw-operations/endurance')
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
      section.items.filter((item) => item.beta)
    )

    expect(betaItems.map((item) => item.to)).toEqual([
      '/stw-operations/endurance',
      '/stw-operations/outpost',
    ])
  })

  it('lists every nav item can-key in the customizable menu relations', () => {
    const related = new Set(
      Object.values(customizableMenuSettingsRelations).flat()
    )
    const itemKeys = navSections.flatMap((section) =>
      section.items.flatMap((item) => [
        ...(item.can ? [item.can] : []),
        ...(item.canAny ?? []),
      ])
    )

    for (const key of itemKeys) {
      expect(related).toContain(key)
    }
  })
})

describe('isMenuOptionVisible', () => {
  it('defaults to visible when the key has never been saved', () => {
    expect(isMenuOptionVisible({}, 'autoKick')).toBe(true)
    expect(isMenuOptionVisible({}, 'endurance')).toBe(true)
  })

  it('hides a tool when its own flag is false', () => {
    expect(isMenuOptionVisible({ taxiService: false }, 'taxiService')).toBe(
      false
    )
  })

  it('hides a section when every listed child is off', () => {
    const allOff = Object.fromEntries(
      customizableMenuSettingsRelations.stwOperations.map((key) => [
        key,
        false,
      ])
    )

    expect(isMenuOptionVisible(allOff, 'stwOperations', true)).toBe(false)
  })

  it('keeps the STW section when endurance is the only visible child', () => {
    const onlyEndurance = Object.fromEntries(
      customizableMenuSettingsRelations.stwOperations.map((key) => [
        key,
        key === 'endurance',
      ])
    )

    expect(isMenuOptionVisible(onlyEndurance, 'stwOperations', true)).toBe(true)
  })
})
