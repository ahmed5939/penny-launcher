import type { Items } from '../expeditions/model'
import type { OpenLlamasProgress } from './model'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const A = 'a'.repeat(32)
const HOLIDAY = 'CardPack:cardpack_event_holiday'
const MINI = 'CardPack:cardpack_basic_mini'

/*
 * Server rendering reads zustand's initial state, not the current one, so
 * the stores are swapped for plain state this test sets directly.
 */
const stores = vi.hoisted(() => ({
  openLlamas: { choices: {} as Record<string, unknown>, runs: {} as Record<string, unknown>, updateChoices: () => undefined, dismissRun: () => undefined },
}))
const pick = <T,>(state: T, selector?: (state: T) => unknown) => (selector ? selector(state) : state)

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../bootstrap/components/load-item-database', () => ({ useRequestItemDatabase: () => undefined }))
vi.mock('../../state/items/database', () => ({
  useItemDatabaseStore: (selector?: (state: unknown) => unknown) => pick({ records: { [MINI.toLowerCase()]: { name: 'Mini Llama' } } }, selector),
  getItemRecord: (records: Record<string, { name: string }>, templateId: string) => records[templateId.toLowerCase()] ?? null,
}))
vi.mock('../../state/accounts/list', () => ({
  useAccountListStore: (selector?: (state: unknown) => unknown) => pick({ accounts: { [A]: { accountId: A, displayName: 'Alpha' } } }, selector),
}))
vi.mock('../../state/stw-operations/open-llamas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../state/stw-operations/open-llamas')>()),
  useOpenLlamasStore: (selector?: (state: unknown) => unknown) => pick(stores.openLlamas, selector),
}))

import { buildPreview } from './model'
import { OpenLlamas } from './view'

function packs(templateId: string, count: number, prefix: string): Items {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}-${i}`, { templateId, quantity: 1 }]))
}

const preview = buildPreview(A, 'p', { ...packs(HOLIDAY, 40, 'h'), ...packs(MINI, 1000, 'm') })

function render(choices: object, run?: Partial<OpenLlamasProgress>) {
  stores.openLlamas.choices = { [A]: { excluded: [], count: '', recycle: 'none', ...choices } }
  stores.openLlamas.runs = run ? { [A]: { accountId: A, status: 'running', target: 500, opened: 120, recycled: 340, kept: 260, packsLeft: 2450, recycle: 'below-rare', message: null, uncertain: null, cancelRequested: false, ...run } } : {}
  return renderToStaticMarkup(createElement(OpenLlamas, { isRefreshing: false, onRefresh: () => undefined, preview }))
}

/** The Open button: the last full-width button on the page. */
function openButton(html: string) {
  return [...html.matchAll(/<button[^>]*class="[^"]*w-full[^"]*"[^>]*>.*?<\/button>/g)].at(-1)?.[0] ?? ''
}

beforeEach(() => {
  stores.openLlamas.choices = {}
  stores.openLlamas.runs = {}
})

describe('Open Llamas view', () => {
  it('starts with every type included and the safe defaults', () => {
    const html = render({})

    expect(html).toContain('Alpha')
    expect(html).toContain('Mini Llama')
    expect(html).toContain('1,040<span class="text-muted-foreground"> / 1,040</span>')
    expect(html.match(/>Included</g)).toHaveLength(2)
    expect(openButton(html)).toContain('Open 1,040 packs')
    expect(openButton(html)).not.toContain(' disabled=""')
  })

  it('keeps a number that no longer fits, explains it, and disables Open', () => {
    const html = render({ excluded: [MINI], count: '50' })

    expect(html).toContain('value="50"')
    expect(html).toMatch(/role="alert".*Only 40 selected packs are available/)
    expect(html).toContain('40<span class="text-muted-foreground"> / 1,040</span>')
    expect(openButton(html)).toContain(' disabled=""')
    expect(html).toContain('>Excluded<')
  })

  it('never treats an empty selection as everything', () => {
    const html = render({ excluded: [HOLIDAY, MINI] })

    expect(html).toContain('Select at least one llama type to open.')
    expect(openButton(html)).toContain(' disabled=""')
    expect(openButton(html)).toContain('Open 0 packs')
  })

  it('shows a running run as totals only, with the settings locked', () => {
    const html = render({ recycle: 'below-rare' }, {})

    expect(html).toContain('Opening llamas…')
    for (const line of ['Packs opened', '120 / 500', 'Items recycled', '340', 'Items not recycled', '260', 'Packs left on account', '2,450']) {
      expect(html).toContain(line)
    }
    expect(html).not.toMatch(/Worker:|Hero:|Schematic:/)
    expect(openButton(html)).toContain(' disabled=""')
    expect(html).toMatch(/<input[^>]*aria-label="Number to open"[^>]*disabled=""/)
  })

  it('separates an uncertain request from the confirmed totals', () => {
    const html = render({}, { status: 'stopped', message: 'Recycling failed without a clear answer from Epic.', uncertain: '3 items in the last recycling request may or may not have been recycled.' })

    expect(html).toContain('Stopped early')
    expect(html).toContain('Not confirmed')
    expect(html).toContain('may or may not have been recycled')
    expect(html).toContain('Close')
  })
})
