import { createContext, useContext, useLayoutEffect, useState } from 'react'
import type { AppearanceTheme } from '../types/window'

import {
  type ColorTheme,
  colorThemes,
  defaultColorTheme,
} from '../config/constants/color-themes'

export type Theme = AppearanceTheme

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
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
  colorThemeStorageKey = 'penny-color-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => window.electronAPI.initialAppearance.source
  )
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    const stored = localStorage.getItem(colorThemeStorageKey)

    return colorThemes.some((current) => current.id === stored)
      ? (stored as ColorTheme)
      : defaultColorTheme
  })

  useLayoutEffect(() => {
    const root = window.document.documentElement
    const apply = (resolved: 'dark' | 'light') => {
      root.classList.remove('light', 'dark')
      root.classList.add(resolved)
    }

    apply(window.electronAPI.initialAppearance.resolved)
    const listener = window.electronAPI.onAppearanceChanged((appearance) => {
      setTheme(appearance.source)
      apply(appearance.resolved)
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  useLayoutEffect(() => {
    /*
     * The colour theme rides on `data-theme` while light/dark stays a class,
     * so the two axes can never clobber each other's DOM writes.
     */
    window.document.documentElement.dataset.theme = colorTheme
  }, [colorTheme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      setTheme(theme)
      window.electronAPI.setAppearanceTheme(theme)
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
