import type { IpcRendererEvent } from 'electron'
import type {
  PresenceRequest,
  PresenceResult,
  PresenceSnapshot,
} from '../../types/presence'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/** Only the request's own fields cross; anything else the caller set stays here. */
function requestOf(request: PresenceRequest): PresenceRequest {
  return {
    accountId: request.accountId,
    text: request.text,
    availability: request.availability,
    durationMinutes: request.durationMinutes,
    replaceActive: request.replaceActive === true,
  }
}

/** Resolves once the status is live, has failed, or a retry is scheduled. */
export function startPresence(request: PresenceRequest): Promise<PresenceResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PresenceStart, requestOf(request))
}

/** Resolves once Epic has accepted the new status, or refused it. */
export function updatePresence(request: PresenceRequest): Promise<PresenceResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PresenceUpdate, requestOf(request))
}

export function stopPresence(): Promise<PresenceResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PresenceStop)
}

/** `null` when presence has not been used since Penny started. */
export function getPresenceStatus(): Promise<PresenceSnapshot | null> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PresenceStatus)
}

export function onPresenceChanged(
  callback: (snapshot: PresenceSnapshot) => void
) {
  const customCallback = (_: IpcRendererEvent, snapshot: PresenceSnapshot) => {
    callback(snapshot)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.PresenceChanged,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.PresenceChanged,
        customCallback
      ),
  }
}
