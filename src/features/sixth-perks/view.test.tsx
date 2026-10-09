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
import { CompletionPage } from './completion-view'
import { SixthPerksPage } from './view'

const first = catalog.weapons[0]
const firstSid = Object.keys(catalog.variants).find((id) => catalog.variants[id].weaponId === first.id && catalog.variants[id].rarity === 'Legendary')!

function copy(id: string, perk: string): SchematicCopy {
  const alterations: Array<string | null> = Array(6).fill(null)
  alterations[catalog.variants[firstSid].slotIndex] = perk
  return { id, templateId: firstSid, level: 50, alterations }
}

function render(page: 'catalog' | 'completion', scan: SixthPerksScan | null, account = true) {
  stores.account = account ? { accountId: A, displayName: 'Alpha' } : null
  stores.sixthPerks.session = scan && { accountId: A, includeBook: false, scan, loading: false, error: null }
  return renderToStaticMarkup(createElement(page === 'catalog' ? SixthPerksPage : CompletionPage))
}

const scanned = (status: 'success' | 'error' = 'success'): SixthPerksScan => ({
  accountId: A,
  fetchedAt: '2026-10-09T00:00:00.000Z',
  inventory: { status, items: status === 'success' ? [copy('owned-copy', first.options[0].id)] : [], error: null },
  book: { status: 'skipped', items: [], error: null },
})

describe('6th Perks pages', () => {
  it('browses the catalog without an account and claims no ownership', () => {
    const html = render('catalog', null, false)
    expect(html).toContain('6th Perks')
    expect(html).toContain('Select an account')
    expect(html).toContain(first.name.replaceAll("'", '&#x27;'))
    expect(html).not.toContain('Missing')
    expect(html).toContain('href="/stw-operations/sixth-perks/completion"')
  })

  it('shows owned rolls and red Missing labels after a scan', () => {
    const html = render('catalog', scanned())
    expect(html).toContain('In inventory (1 Legendary)')
    expect(html).toMatch(/text-destructive[^>]*>Missing</)
  })

  it('keeps a failed inventory read unknown rather than missing', () => {
    const html = render('catalog', scanned('error'))
    expect(html).toContain('Partial results')
    expect(html).toContain('Inventory unknown')
    expect(html).not.toMatch(/>Missing</)
  })

  it('renders the planner with costs and a way back', () => {
    const html = render('completion', scanned())
    expect(html).toContain('Path to completion')
    expect(html).toContain('Legendary Flux')
    expect(html).toContain('Core RE-PERK')
    expect(html).toContain('href="/stw-operations/sixth-perks"')
  })

  it('asks for a scan before planning', () => {
    expect(render('completion', null)).toContain('Scan to build your plan')
  })
})
