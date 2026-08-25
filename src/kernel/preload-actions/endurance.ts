import type { IpcRendererEvent } from 'electron'
import type { AccountData } from '../../types/accounts'
import type {
  EnduranceConfig,
  EnduranceEvent,
  EndurancePointDefinition,
  EnduranceStatus,
  EnduranceZone,
} from '../../types/endurance'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export type EnduranceSnapshot = {
  config: EnduranceConfig
  pointDefinitions: Array<EndurancePointDefinition>
  status: EnduranceStatus
  zones: Record<EnduranceZone, { name: string; rightClicks: number }>
}

export function enduranceStatusRequest(): Promise<EnduranceSnapshot> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.EnduranceStatusRequest)
}

export function enduranceStart(account: AccountData) {
  ipcRenderer.send(ElectronAPIEventKeys.EnduranceStart, account)
}

export function enduranceStop() {
  ipcRenderer.send(ElectronAPIEventKeys.EnduranceStop)
}

export function enduranceConfigUpdate(
  partial: Partial<EnduranceConfig>,
): Promise<EnduranceConfig> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.EnduranceConfigUpdate,
    partial,
  )
}

export function enduranceCalibrateStart(pointId: string) {
  ipcRenderer.send(ElectronAPIEventKeys.EnduranceCalibrateStart, pointId)
}

export function enduranceCalibrateCancel() {
  ipcRenderer.send(ElectronAPIEventKeys.EnduranceCalibrateCancel)
}

export function enduranceNotification(
  callback: (value: EnduranceEvent) => Promise<void>,
) {
  const customCallback = (_: IpcRendererEvent, value: EnduranceEvent) => {
    callback(value).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.EnduranceNotification,
    customCallback,
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.EnduranceNotification,
        customCallback,
      ),
  }
}
