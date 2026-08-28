import { createContext, useContext, useEffect, useState } from 'react'

import {
  type ColorTheme,
  colorThemes,
  defaultColorTheme,
} from '../config/constants/color-themes'

export type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  colorThemeStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  colorTheme: ColorTheme
  setColorTheme: (colorTheme: ColorTheme) => void
}

const initialState: ThemeProviderState = {
  theme: 'dark',
  setTheme: () => null,
  colorTheme: defaultColorTheme,
  setColorTheme: () => null,
}

const ThemeProviderContext =
  createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = initialState.theme,
  storageKey = 'vite-ui-theme',
  colorThemeStorageKey = 'penny-color-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const stored = localStorage.getItem(colorThemeStorageKey)

    return colorThemes.some((current) => current.id === stored)
      ? (stored as ColorTheme)
      : defaultColorTheme
  })

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme

    root.classList.add(resolved)

    /**
     * Windows draws the caption buttons, so the `.dark` class never reaches
     * them — they have to be repainted through the main process or they stay
     * on last session's theme.
     */
    window.electronAPI?.syncWindowChromeTheme?.(resolved)
  }, [theme])

  useEffect(() => {
    /*
     * The colour theme rides on `data-theme` while light/dark stays a class,
     * so the two axes can never clobber each other's DOM writes.
     */
    window.document.documentElement.dataset.theme = colorTheme
  }, [colorTheme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    colorTheme,
    setColorTheme: (colorTheme: ColorTheme) => {
      localStorage.setItem(colorThemeStorageKey, colorTheme)
      setColorTheme(colorTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider
      {...props}
      value={value}
    >
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
