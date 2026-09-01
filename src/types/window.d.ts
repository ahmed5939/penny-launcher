/**
 * What the main process tells the renderer about the chrome it is sitting in.
 *
 * The shell needs all three: `mica` decides whether the titlebar, rail and
 * status bar go translucent or stay opaque, `maximized` removes the window's
 * rounded corners and outer border, and `titleBarHeight` keeps the header
 * aligned with the caption buttons Windows draws.
 */
export type WindowChromeState = {
  maximized: boolean
  mica: boolean
  titleBarHeight: number
}

export type AppearanceTheme = 'dark' | 'light' | 'system'
export type ResolvedAppearanceTheme = Exclude<AppearanceTheme, 'system'>
