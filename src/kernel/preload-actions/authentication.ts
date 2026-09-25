import type { IpcRendererEvent } from 'electron'
import type { AccountData } from '../../types/accounts'
import type { AuthenticationByDeviceProperties } from '../../types/authentication'
import type {
  AuthCallbackResponseParam,
  EpicGamesSettingsNotificationCallbackResponseParam,
  GenerateExchangeCodeNotificationCallbackResponseParam,
  QuickLoginStatusParam,
} from '../../types/preload'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/**
 * Authentication
 */

export function createAuthWithExchange(code: string) {
  ipcRenderer.send(ElectronAPIEventKeys.CreateAuthWithExchange, code)
}

export function checkAllAccountStatuses() {
  ipcRenderer.send(ElectronAPIEventKeys.CheckAllAccountStatuses)
}

export function responseAuthWithExchange(
  callback: (values: AuthCallbackResponseParam) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    values: AuthCallbackResponseParam
  ) => {
    callback(values).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ResponseAuthWithExchange,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ResponseAuthWithExchange,
        customCallback
      ),
  }
}

export function createAuthWithAuthorization(code: string) {
  ipcRenderer.send(ElectronAPIEventKeys.CreateAuthWithAuthorization, code)
}

export function responseAuthWithAuthorization(
  callback: (values: AuthCallbackResponseParam) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    values: AuthCallbackResponseParam
  ) => {
    callback(values).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ResponseAuthWithAuthorization,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ResponseAuthWithAuthorization,
        customCallback
      ),
  }
}

export function createAuthWithDevice(
  data: AuthenticationByDeviceProperties
) {
  ipcRenderer.send(ElectronAPIEventKeys.CreateAuthWithDevice, data)
}

export function responseAuthWithDevice(
  callback: (values: AuthCallbackResponseParam) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    values: AuthCallbackResponseParam
  ) => {
    callback(values).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ResponseAuthWithDevice,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ResponseAuthWithDevice,
        customCallback
      ),
  }
}

export function createAuthWithQuickLogin() {
  ipcRenderer.send(ElectronAPIEventKeys.CreateAuthWithQuickLogin)
}

export function cancelAuthWithQuickLogin() {
  ipcRenderer.send(ElectronAPIEventKeys.CancelAuthWithQuickLogin)
}

export function responseQuickLoginStatus(
  callback: (values: QuickLoginStatusParam) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    values: QuickLoginStatusParam
  ) => {
    callback(values).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.QuickLoginStatus,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.QuickLoginStatus,
        customCallback
      ),
  }
}

export function responseAuthWithQuickLogin(
  callback: (values: AuthCallbackResponseParam) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    values: AuthCallbackResponseParam
  ) => {
    callback(values).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ResponseAuthWithQuickLogin,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ResponseAuthWithQuickLogin,
        customCallback
      ),
  }
}

export function openEpicGamesSettings(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.OpenEpicGamesSettings, account)
}

export function responseEpicGamesSettings(
  callback: (
    values: EpicGamesSettingsNotificationCallbackResponseParam
  ) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    values: EpicGamesSettingsNotificationCallbackResponseParam
  ) => {
    callback(values).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.OpenEpicGamesSettingsNotification,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.OpenEpicGamesSettingsNotification,
        customCallback
      ),
  }
}

export function generateExchangeCode(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.GenerateExchangeCode, account)
}

export function responseGenerateExchangeCode(
  callback: (
    response: GenerateExchangeCodeNotificationCallbackResponseParam
  ) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: GenerateExchangeCodeNotificationCallbackResponseParam
  ) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ResponseGenerateExchangeCode,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ResponseGenerateExchangeCode,
        customCallback
      ),
  }
}
