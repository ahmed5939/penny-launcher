import type { IpcRendererEvent } from 'electron'
import type { OverlaySnapshot } from '../types/overlay'

import { contextBridge, ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../config/constants/main-process'

/**
 * Deliberately tiny: unlike Penny's main window, the overlay can only receive
 * an already-sanitized snapshot. It cannot invoke account or launcher IPC.
 */
// Listen as soon as preload runs: the renderer entry and React mount are
// asynchronous, so the first snapshot can arrive before onSnapshot subscribes.
let latestSnapshot: OverlaySnapshot | undefined
const subscribers = new Set<(snapshot: OverlaySnapshot) => void>()
ipcRenderer.on(
  ElectronAPIEventKeys.OverlaySnapshot,
  (_event: IpcRendererEvent, snapshot: OverlaySnapshot) => {
    latestSnapshot = snapshot
    subscribers.forEach((callback) => callback(snapshot))
  },
)

contextBridge.exposeInMainWorld('pennyOverlay', {
  onSnapshot(callback: (snapshot: OverlaySnapshot) => void) {
    subscribers.add(callback)
    if (latestSnapshot) callback(latestSnapshot)

    return {
      removeListener: () => {
        subscribers.delete(callback)
      },
    }
  },
})
