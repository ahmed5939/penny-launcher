import type { IpcRendererEvent } from 'electron'
import type { OverlaySnapshot } from '../types/overlay'

import { contextBridge, ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../config/constants/main-process'

/**
 * Deliberately tiny: unlike Penny's main window, the overlay can only receive
 * an already-sanitized snapshot. It cannot invoke account or launcher IPC.
 */
contextBridge.exposeInMainWorld('pennyOverlay', {
  onSnapshot(callback: (snapshot: OverlaySnapshot) => void) {
    const listener = (_: IpcRendererEvent, snapshot: OverlaySnapshot) => {
      callback(snapshot)
    }

    ipcRenderer.on(ElectronAPIEventKeys.OverlaySnapshot, listener)

    return {
      removeListener: () =>
        ipcRenderer.removeListener(
          ElectronAPIEventKeys.OverlaySnapshot,
          listener
        ),
    }
  },
})
