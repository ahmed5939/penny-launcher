import type { IpcRendererEvent } from 'electron'
import type { LanguageResponse } from '../../types/settings'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { Language } from '../../locales/resources'

/**
 * Language
 */

export function requestAppLanguage() {
  ipcRenderer.send(ElectronAPIEventKeys.AppLanguageRequest)
}

export function changeAppLanguage(language: Language) {
  ipcRenderer.send(ElectronAPIEventKeys.AppLanguageUpdate, language)
}

export function appLanguageNotification(
  callback: (value: LanguageResponse) => Promise<void>,
) {
  const customCallback = (
    _: IpcRendererEvent,
    value: LanguageResponse,
  ) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.AppLanguageNotification,
    customCallback,
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.AppLanguageNotification,
        customCallback,
      ),
  }
}

/**
 * Settings
 */

export function detectGamePath(): Promise<{
  appVersion: string
  name: string
  path: string
}> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.SettingsDetectPath)
}
