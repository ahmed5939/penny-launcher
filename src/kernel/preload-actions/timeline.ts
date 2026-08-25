import type { IpcRendererEvent } from 'electron'
import type { TimelinePayload } from '../core/timeline'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function requestTimeline() {
  ipcRenderer.send(ElectronAPIEventKeys.TimelineRequest)
}

export function responseTimeline(
  callback: (response: TimelinePayload) => Promise<void>
) {
  const customCallback = (
    _: IpcRendererEvent,
    response: TimelinePayload
  ) => {
    callback(response).catch(() => {})
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.TimelineResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.TimelineResponse,
        customCallback
      ),
  }
}
