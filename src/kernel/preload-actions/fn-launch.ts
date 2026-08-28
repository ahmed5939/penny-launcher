import type {
  FnLaunchSettings,
  GameSettings,
  GameSettingsResult,
  GameSettingsSaveResult,
} from '../../types/fn-launch'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/**
 * FN Launch Settings
 */

export function fnLaunchSettingsRequest(): Promise<FnLaunchSettings> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FnLaunchSettingsRequest)
}

export function fnLaunchSettingsUpdate(
  config: FnLaunchSettings
): Promise<{ success: boolean }> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.FnLaunchSettingsUpdate,
    config
  )
}

export function fnLaunchGameSettingsRequest(): Promise<GameSettingsResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FnLaunchGameSettingsRequest)
}

export function fnLaunchGameSettingsUpdate(
  partial: Partial<GameSettings>
): Promise<GameSettingsSaveResult> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.FnLaunchGameSettingsUpdate,
    partial
  ) as Promise<GameSettingsSaveResult>
}
