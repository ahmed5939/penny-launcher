import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Radar } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../hooks/accounts', () => ({ useGetSelectedAccount: () => ({ selected: null }) }))

import { AccountResourceGate, type AccountResource } from './account-resource'
import { Pager, ToolBadges, paginate } from './controls'

const resource = (over: Partial<AccountResource<string>>): AccountResource<string> => ({
  accountId: 'acc', data: null, error: null, loading: false, refresh: () => undefined, ...over,
})
const gate = (r: ReturnType<typeof resource>, loading?: { title: string; description: string }) =>
  renderToStaticMarkup(
    <AccountResourceGate<string> icon={Radar} loading={loading} resource={r} what="the backpack">
      {(data) => `DATA:${data}`}
    </AccountResourceGate>
  )

describe('page kit controls', () => {
  it('paginate clamps a page that no longer exists', () => {
    expect(paginate([1, 2, 3, 4, 5], 9, 2)).toEqual({ page: 2, items: [5] })
    expect(paginate([], 3, 10)).toEqual({ page: 0, items: [] })
  })

  it('Pager renders nothing when one page holds everything', () => {
    expect(renderToStaticMarkup(createElement(Pager, { onPageChange: () => undefined, page: 0, pageSize: 20, total: 20 }))).toBe('')
    expect(renderToStaticMarkup(createElement(Pager, { onPageChange: () => undefined, page: 1, pageSize: 20, total: 45 }))).toContain('Page <span class="figure">2</span> of <span class="figure">3</span>')
  })

  it('ToolBadges says Beta and Read-only only when asked', () => {
    expect(renderToStaticMarkup(createElement(ToolBadges, {}))).toBe('')
    const both = renderToStaticMarkup(createElement(ToolBadges, { beta: true, readOnly: true }))
    expect(both).toContain('Beta')
    expect(both).toContain('Read-only')
  })

  it('AccountResourceGate walks no account → error → loading → data', () => {
    expect(gate(resource({ accountId: null }))).toContain('Choose an account')
    expect(gate(resource({ error: 'HTTP 500' }))).toMatch(/role="alert".*Could not load the backpack.*HTTP 500/)
    expect(gate(resource({ loading: true }))).toMatch(/role="status".*Loading the backpack…/)
    expect(gate(resource({ loading: true }), { title: 'Scanning…', description: 'Four inventories.' })).toContain('Scanning…')
    expect(gate(resource({ data: 'x' }))).toBe('DATA:x')
  })

  it('keeps showing data while a refresh is in flight', () => {
    expect(gate(resource({ data: 'x', loading: true }))).toBe('DATA:x')
  })
})
