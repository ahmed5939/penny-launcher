import { beforeEach, describe, expect, it } from 'vitest'

import { defaultInventoryFilters, useInventoryStore } from './inventory'

describe('inventory filters', () => {
  beforeEach(() => {
    useInventoryStore.setState({ filters: defaultInventoryFilters })
  })

  it('clears the search and schematic type when the kind changes', () => {
    useInventoryStore.getState().updateFilters({ search: 'ninja', schematicType: 'Ranged' })
    useInventoryStore.getState().updateFilters({ kinds: ['survivor'] })

    expect(useInventoryStore.getState().filters).toMatchObject({ kinds: ['survivor'], search: '', schematicType: 'all' })
  })

  it('keeps the search when the kind stays the same', () => {
    useInventoryStore.getState().updateFilters({ search: 'ninja' })
    useInventoryStore.getState().updateFilters({ kinds: ['schematic'] })

    expect(useInventoryStore.getState().filters.search).toBe('ninja')
  })

  it('lets explicit values in the same update win over the reset', () => {
    useInventoryStore.getState().updateFilters({ search: 'ninja' })
    useInventoryStore.getState().updateFilters({ kinds: ['hero'], search: 'raven' })

    expect(useInventoryStore.getState().filters).toMatchObject({ kinds: ['hero'], search: 'raven', schematicType: 'all' })
  })

  it('keeps the recycle ceiling when the kind changes', () => {
    useInventoryStore.getState().updateFilters({ maxRarity: 'rare', maxTier: 3 })
    useInventoryStore.getState().updateFilters({ kinds: ['defender'] })

    expect(useInventoryStore.getState().filters).toMatchObject({ maxRarity: 'rare', maxTier: 3 })
  })
})
