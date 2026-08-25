import type { IpcRendererEvent } from 'electron'
import type { DevSettings, Settings } from '../../types/settings'
import type { WindowChromeState } from '../../types/window'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestAccounts() {
  ipcRenderer.send(ElectronAPIEventKeys.RequestAccounts)
}

export function requestDevSettings() {
  ipcRenderer.send(ElectronAPIEventKeys.DevSettingsRequest)
}

export function requestSettings() {
  ipcRenderer.send(ElectronAPIEventKeys.RequestSettings)
}

export function updateSettings(settings: Settings) {
  ipcRenderer.send(ElectronAPIEventKeys.UpdateSettings, settings)
}

export function killProcess() {
  ipcRenderer.send(ElectronAPIEventKeys.CustomProcessKill)
}

export function notificationDevSettings(
  callback: (value: DevSettings) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: DevSettings) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.DevSettingsResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.DevSettingsResponse,
        customCallback
      ),
  }
}

export function responseSettings(
  callback: (value: Settings) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: Settings) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.OnLoadSettings,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.OnLoadSettings,
        customCallback
      ),
  }
}

export function notificationCustomProcessStatus(
  callback: (value: boolean) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, value: boolean) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.CustomProcessStatus,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.CustomProcessStatus,
        customCallback
      ),
  }
}

export function openExternalURL(url: string) {
  ipcRenderer.send(ElectronAPIEventKeys.OpenExternalURL, url)
}

export function closeWindow() {
  ipcRenderer.send(ElectronAPIEventKeys.CloseWindow)
}

export function minimizeWindow() {
  ipcRenderer.send(ElectronAPIEventKeys.MinimizeWindow)
}

export function maximizeWindow() {
  ipcRenderer.send(ElectronAPIEventKeys.MaximizeWindow)
}

/**
 * Windows draws the caption buttons itself, so it has to be told when the
 * renderer's theme changes — the `.dark` class does not reach them.
 */
export function syncWindowChromeTheme(theme: 'dark' | 'light') {
  ipcRenderer.send(ElectronAPIEventKeys.WindowChromeTheme, theme)
}

export function onWindowChromeState(
  callback: (value: WindowChromeState) => void
) {
  const customCallback = (_: IpcRendererEvent, value: WindowChromeState) => {
    callback(value)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.WindowChromeState,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.WindowChromeState,
        customCallback
      ),
  }
}
