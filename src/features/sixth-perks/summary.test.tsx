import type { SchematicCopy, SixthPerksScan } from './types'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const A = 'a'.repeat(32)

/*
 * Server rendering reads zustand's initial state, not the current one, so
 * the stores are swapped for plain state this test sets directly.
 */
const stores = vi.hoisted(() => ({
  account: null as null | { accountId: string; displayName: string },
  sixthPerks: { includeBook: false, session: null as unknown, focusWeapon: null, scan: async () => undefined, setIncludeBook: () => undefined, setFocusWeapon: () => undefined },
}))
const pick = <T,>(state: T, selector?: (state: T) => unknown) => (selector ? selector(state) : state)

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: unknown; to: string }) => createElement('a', { href: to }, children as never),
  useNavigate: () => () => undefined,
}))
vi.mock('../../bootstrap/components/load-item-database', () => ({ useRequestItemDatabase: () => undefined }))
vi.mock('../../state/items/database', () => ({
  useItemDatabaseStore: (selector?: (state: unknown) => unknown) => pick({ records: {} }, selector),
  getItemRecord: (records: Record<string, unknown>, templateId: string) => records[templateId.toLowerCase()] ?? null,
}))
vi.mock('../../hooks/accounts', () => ({ useGetSelectedAccount: () => ({ selected: stores.account }) }))
vi.mock('../../state/stw-operations/sixth-perks', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../state/stw-operations/sixth-perks')>()
  const useSixthPerksStore = Object.assign((selector?: (state: unknown) => unknown) => pick(stores.sixthPerks, selector), { getState: () => stores.sixthPerks })
  return { ...original, useSixthPerksStore }
})

import { catalog } from './model'
import { SixthPerksPage } from './view'

const first = catalog.weapons[0]
const firstSid = Object.keys(catalog.variants).find((id) => catalog.variants[id].weaponId === first.id && catalog.variants[id].rarity === 'Legendary')!

function copy(id: string, perk: string): SchematicCopy {
  const alterations: Array<string | null> = Array(6).fill(null)
  alterations[catalog.variants[firstSid].slotIndex] = perk
  return { id, templateId: firstSid, level: 50, alterations }
}

function render(scan: SixthPerksScan | null, loading = false) {
  stores.account = { accountId: A, displayName: 'Alpha' }
  stores.sixthPerks.session = { accountId: A, includeBook: false, scan, loading, error: null }
  return renderToStaticMarkup(createElement(SixthPerksPage))
}

const scanned = (): SixthPerksScan => ({
  accountId: A,
  fetchedAt: '2026-10-09T00:00:00.000Z',
  inventory: { status: 'success', items: [copy('owned-copy', first.options[0].id)], error: null },
  book: { status: 'skipped', items: [], error: null },
})

describe('6th perks summary', () => {
  it('keeps the figures to three tiles after a scan', () => {
    const figures = render(scanned()).match(/text-display-sm font-bold leading-none/g) ?? []
    expect(figures.length).toBeGreaterThan(0)
    expect(figures.length).toBeLessThanOrEqual(3)
  })

  it('offers completion as a filter rather than a tile per count', () => {
    const html = render(scanned())
    expect(html).toContain('aria-label="Completion"')
    expect(html).not.toMatch(/micro-label block">Missing \d/)
  })

  it('says a scan is running before its first result', () => {
    const html = render(null, true)
    expect(html).toContain('Scanning schematics…')
    expect(html).not.toContain('Scan to check your schematics')
  })

  it('draws no coloured stripe on weapon cards', () => {
    expect(render(scanned())).not.toContain('border-left')
  })
})
