import { createElement, type AnchorHTMLAttributes } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  pathname: '/stw-operations/inventory',
  compact: false,
  collapsed: false,
  hidden: [] as Array<string>,
}))
// Structural SSR checks do not run browser layout or focus effects.
vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useLayoutEffect: react.useEffect }
})
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => state.pathname,
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    params?: unknown
  }) => {
    const attributes = { ...props }
    delete attributes.params
    return createElement('a', { href: to, ...attributes })
  },
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../hooks/ui/media-query', () => ({
  useMediaQuery: () => state.compact,
}))
vi.mock('../../state/ui/shell', () => ({
  useShellStore: () => ({
    paneCollapsed: state.collapsed,
    togglePane: vi.fn(),
    lastPaths: {},
    rememberPath: vi.fn(),
  }),
}))
vi.mock('../../hooks/accounts', () => ({
  useGetAccounts: () => ({
    accountsArray: [{ accountId: 'one', authStatus: 'valid' }],
  }),
}))
vi.mock('../../hooks/settings', () => ({
  useCustomizableMenuSettingsVisibility: () => ({
    getMenuOptionVisibility: (key: string) => !state.hidden.includes(key),
  }),
  useCustomizableMenuSettingsActions: () => ({
    updateMenuOption: () => vi.fn(),
  }),
}))
vi.mock('../../hooks/stw-operations/taxi-service', () => ({
  useGetTaxiServiceDataStatus: () => ({ status: null }),
}))
vi.mock('../../hooks/stw-operations/automation', () => ({
  useGetAutomationDataStatus: () => ({ status: null }),
}))

import { TooltipProvider } from '../ui/tooltip'
import { AreaNavigation } from './area-rail'

const render = () =>
  renderToStaticMarkup(
    createElement(TooltipProvider, { children: createElement(AreaNavigation) }),
  )
beforeEach(() => {
  state.pathname = '/stw-operations/inventory'
  state.compact = false
  state.collapsed = false
  state.hidden = []
})

describe('area shell rendering', () => {
  it('shows only the active area in the contextual pane', () => {
    const markup = render()
    expect(markup).toContain('data-app-focus-region="pane"')
    expect(markup).toContain('href="/stw-operations/inventory"')
    expect(markup).not.toContain('href="/stw-operations/taxi-service"')
  })
  it.each(['compact', 'collapsed'] as const)(
    'unmounts the pane in %s mode and keeps Customize reachable',
    (mode) => {
      state[mode] = true
      const markup = render()
      expect(markup).not.toContain('data-app-focus-region="pane"')
      expect(markup).toContain('aria-label="sidebar:customize.title"')
      expect(markup).toContain('aria-haspopup="dialog"')
    },
  )
  it('keeps a hidden destination identifiable when opened from the palette', () => {
    state.hidden = ['stwOperations', 'inventory']
    const markup = render()
    expect(markup).toContain('href="/stw-operations/inventory"')
    expect(markup).toContain('aria-current="page"')
    expect(markup).not.toContain('href="/stw-operations/loadouts"')
  })
  it('does not show an empty Automate area when only STW tools remain visible', () => {
    state.hidden = ['taxiService', 'party', 'autoLlamas', 'autoPinUrns']
    expect(render()).not.toContain('aria-label="sidebar:groups.automate"')
  })
})
