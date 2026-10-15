import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ThemeModeToggle, ThemeSwatchGrid } from './theme-picker'

const strings = vi.hoisted((): Record<string, string> => ({
  'app-settings.form.appearance.label': 'Mode',
  'app-settings.form.appearance.theme.label': 'Colour theme',
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => strings[key] ?? key }),
}))

vi.mock('./theme-provider', () => ({
  useTheme: () => ({
    colorTheme: 'stonewood',
    setColorTheme: () => undefined,
    setTheme: () => undefined,
    theme: 'dark',
  }),
}))

describe('theme picker groups', () => {
  it('names the mode group Mode', () => {
    const markup = renderToStaticMarkup(<ThemeModeToggle />)

    expect(markup).toContain('role="radiogroup"')
    expect(markup).toContain('aria-label="Mode"')
  })

  it('names the palette group Colour theme', () => {
    const markup = renderToStaticMarkup(<ThemeSwatchGrid />)

    expect(markup).toContain('role="group"')
    expect(markup).toContain('aria-label="Colour theme"')
  })

  it('takes a caller-supplied name over the default', () => {
    expect(renderToStaticMarkup(<ThemeModeToggle aria-label="Window" />)).toContain('aria-label="Window"')
    expect(renderToStaticMarkup(<ThemeSwatchGrid aria-label="Palette" />)).toContain('aria-label="Palette"')
  })
})
