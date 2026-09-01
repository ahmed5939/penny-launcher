import type {
  AppearanceTheme,
  ResolvedAppearanceTheme,
} from '../../types/window'
import type { BrowserWindow } from 'electron'

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app, nativeTheme } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { resolveLauncherDataDirectory } from '../launcher-paths'
import { RuntimeLog } from '../runtime-log'
import { WindowChrome } from './window-chrome'

const themes = new Set<AppearanceTheme>(['dark', 'light', 'system'])

export class Appearance {
  private static source: AppearanceTheme = 'dark'
  private static restored = false
  private static window: BrowserWindow | null = null
  private static writeQueue = Promise.resolve()

  private static get filePath() {
    return path.join(
      resolveLauncherDataDirectory(app.getPath('appData')),
      'appearance.json'
    )
  }

  static get themeSource() {
    return Appearance.source
  }

  static get resolvedTheme(): ResolvedAppearanceTheme {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  static async restore() {
    if (Appearance.restored) {
      return
    }

    Appearance.restored = true
    try {
      const parsed = JSON.parse(
        await readFile(Appearance.filePath, 'utf8')
      ) as { theme?: AppearanceTheme }

      if (parsed.theme && themes.has(parsed.theme)) {
        Appearance.source = parsed.theme
      }
    } catch {
      // First launch (or a damaged preference) intentionally uses dark.
    }

    nativeTheme.themeSource = Appearance.source
    nativeTheme.on('updated', () => Appearance.broadcast())
  }

  static attach(window: BrowserWindow) {
    Appearance.window = window
    Appearance.applyToWindow()
  }

  static set(theme: AppearanceTheme) {
    if (!themes.has(theme)) {
      return
    }

    Appearance.source = theme
    nativeTheme.themeSource = theme
    Appearance.persist()
    Appearance.broadcast()
  }

  private static applyToWindow() {
    const window = Appearance.window

    if (!window || window.isDestroyed()) {
      return
    }

    const resolved = Appearance.resolvedTheme

    try {
      window.setTitleBarOverlay(WindowChrome.overlay(resolved))
    } catch {
      // Title-bar overlays are Windows-specific.
    }

    window.setBackgroundColor(WindowChrome.backgroundColor(resolved))
  }

  private static broadcast() {
    Appearance.applyToWindow()

    const window = Appearance.window

    if (!window || window.isDestroyed()) {
      return
    }

    window.webContents.send(ElectronAPIEventKeys.AppearanceChanged, {
      resolved: Appearance.resolvedTheme,
      source: Appearance.source,
    })
  }

  private static persist() {
    Appearance.writeQueue = Appearance.writeQueue
      .then(async () => {
        await mkdir(path.dirname(Appearance.filePath), { recursive: true })
        await writeFile(
          Appearance.filePath,
          `${JSON.stringify({ theme: Appearance.source }, null, 2)}\n`,
          'utf8'
        )
      })
      .catch((error) => RuntimeLog.error('appearance:persist', error))
  }
}
