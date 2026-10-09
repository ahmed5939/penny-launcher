import type { IpcRendererEvent } from 'electron'
import type { OpenLlamasProgress, OpenLlamasRequest } from '../../features/open-llamas/model'
import type { PreviewResult, StartResult } from '../core/open-llamas'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Reads the account's unopened packs. The answer's `previewId` is what a run must quote. */
export function requestLlamaPreview(accountId: string): Promise<PreviewResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.OpenLlamasPreview, accountId)
}

/** Only the request's own fields cross; anything else the caller set stays here. */
export function startOpenLlamas(request: OpenLlamasRequest): Promise<StartResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.OpenLlamasStart, {
    accountId: request.accountId,
    previewId: request.previewId,
    templateIds: [...request.templateIds],
    count: request.count,
    recycle: request.recycle,
  })
}

export function cancelOpenLlamas(accountId: string): Promise<boolean> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.OpenLlamasCancel, accountId)
}

export function getOpenLlamasStatus(): Promise<Array<OpenLlamasProgress>> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.OpenLlamasStatus)
}

export function onOpenLlamasProgress(callback: (progress: OpenLlamasProgress) => void) {
  const customCallback = (_: IpcRendererEvent, progress: OpenLlamasProgress) => {
    callback(progress)
  }
  const rendererInstance = ipcRenderer.on(ElectronAPIEventKeys.OpenLlamasProgress, customCallback)

  return {
    removeListener: () => rendererInstance.removeListener(ElectronAPIEventKeys.OpenLlamasProgress, customCallback),
  }
}
