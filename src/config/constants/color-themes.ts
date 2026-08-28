/**
 * Colour theme catalogue.
 *
 * Each entry maps to a `[data-theme]` block in `globals.css`; the
 * ThemeProvider writes the id onto <html> and the CSS does the rest. The
 * gradient triple mirrors that theme's `--brand-from/via/to` so the settings
 * swatches preview the real palette without mounting it.
 *
 * Names are Save the World zones — proper nouns, so they are deliberately
 * not translated.
 */
export const colorThemes = [
  {
    id: 'penny',
    name: 'Penny',
    gradient: ['344 78% 72%', '336 78% 56%', '322 72% 44%'],
  },
  {
    id: 'stonewood',
    name: 'Stonewood',
    gradient: ['95 65% 62%', '150 62% 45%', '172 70% 32%'],
  },
  {
    id: 'plankerton',
    name: 'Plankerton',
    gradient: ['190 80% 66%', '207 80% 52%', '228 65% 45%'],
  },
  {
    id: 'canny',
    name: 'Canny Valley',
    gradient: ['45 95% 62%', '30 88% 54%', '12 75% 46%'],
  },
  {
    id: 'twine',
    name: 'Twine Peaks',
    gradient: ['288 75% 72%', '265 78% 62%', '244 70% 52%'],
  },
  {
    id: 'ventures',
    name: 'Ventures',
    gradient: ['165 80% 60%', '187 88% 44%', '212 80% 46%'],
  },
] as const

export type ColorTheme = (typeof colorThemes)[number]['id']

export const defaultColorTheme: ColorTheme = 'penny'
