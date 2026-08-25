import os from 'node:os'

export type WindowChromeTheme = 'dark' | 'light'

/**
 * Height of the draggable strip, and therefore of the system caption buttons
 * Windows draws into it. Mirrors `--header-height` in globals.css — if the two
 * disagree, the buttons stop lining up with the header content.
 */
export const titleBarHeight = 40

/**
 * Titlebar colours, sampled from the same tokens the renderer uses:
 * `--surface` for the strip, `--foreground` for the glyphs.
 */
const overlayColors: Record<
  WindowChromeTheme,
  { color: string; symbolColor: string }
> = {
  dark: { color: '#130c0f', symbolColor: '#f9f6f7' },
  light: { color: '#fcf8f9', symbolColor: '#201318' },
}

export class WindowChrome {
  /**
   * Mica — the desktop wallpaper blurred and tinted through the window base.
   *
   * Electron exposes it as `backgroundMaterial`, which needs Windows 11 22H2
   * (build 22621) to render properly; earlier builds either ignore it or draw
   * an untinted acrylic that fights every surface above it. Everything else
   * falls back to the solid `--background`.
   */
  static get supportsMica() {
    if (process.platform !== 'win32') {
      return false
    }

    const build = Number.parseInt(os.release().split('.')[2] ?? '0', 10)

    return Number.isFinite(build) && build >= 22621
  }

  static overlay(theme: WindowChromeTheme) {
    return {
      ...overlayColors[theme],
      height: titleBarHeight,
    }
  }

  /**
   * With Mica on, the window base must stay transparent for the material to
   * show through; without it we keep painting the dark ground so launch does
   * not flash white before the renderer's first frame.
   */
  static get backgroundColor() {
    return WindowChrome.supportsMica ? '#00000000' : '#0d080a'
  }
}
