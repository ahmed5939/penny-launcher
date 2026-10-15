import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { Route } from './$type'

vi.mock('../../__root', () => ({ Route: {} }))
vi.mock('@tanstack/react-router', () => ({
  createRoute: (options: object) => ({
    ...options,
    useParams: () => ({ type: 'quick-login' }),
  }),
  useNavigate: () => vi.fn(),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('./-hooks', () => ({
  useAerialImport: () => ({ importFromAerial: vi.fn(), isImporting: true }),
}))
vi.mock('./(quick-login)/-page', () => ({ QuickLoginPage: () => null }))
vi.mock('./(authorization-code)/-page', () => ({
  AuthorizationCodePage: () => null,
}))
vi.mock('./(exchange-code)/-page', () => ({ ExchangeCodePage: () => null }))
vi.mock('./(device-auth)/-page', () => ({ DeviceAuthPage: () => null }))

describe('add account method list', () => {
  it('is navigation, not tabs, and names the import while it runs', () => {
    const markup = renderToStaticMarkup(createElement(Route.component))

    expect(markup).not.toContain('role="tab"')
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1)
    expect(markup).toContain('Importing…')
  })
})
