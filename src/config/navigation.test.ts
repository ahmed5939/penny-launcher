import { describe, expect, it } from 'vitest'

import { navSections } from '../config/navigation'

describe('navigation', () => {
  const destinations = navSections.flatMap((section) => [
    ...(section.to ? [section.to] : []),
    ...section.items.map((item) => item.to),
  ])

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

  it('only badges endurance as beta', () => {
    const betaItems = navSections.flatMap((section) =>
      section.items.filter((item) => item.beta)
    )

    expect(betaItems.map((item) => item.to)).toEqual([
      '/stw-operations/endurance',
    ])
  })
})
