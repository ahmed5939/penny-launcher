import type { IpcRendererEvent } from 'electron'
import type { ContextMenuRequestItem } from '../startup/context-menu'
import type { NativeNotificationPayload } from '../startup/notifications'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/**
 * Fills the taskbar icon. `null` clears it, a 0–1 fraction fills it, and
 * `'indeterminate'` pulses for work whose length is genuinely unknown.
 */
export function setTaskbarProgress(
  value: number | null | 'indeterminate'
) {
  ipcRenderer.send(ElectronAPIEventKeys.TaskbarProgress, value)
}

/**
 * Overlay badge on the taskbar button. The renderer draws the image because
 * `nativeImage` cannot rasterise vector art.
 */
export function setTaskbarBadge(
  dataUrl: string | null,
  description: string
) {
  ipcRenderer.send(ElectronAPIEventKeys.TaskbarBadge, dataUrl, description)
}

export function setTaskbarJumpList(
  accounts: Array<{ accountId: string; displayName: string }>
) {
  ipcRenderer.send(ElectronAPIEventKeys.TaskbarJumpList, accounts)
}

export function sendNativeNotification(
  payload: NativeNotificationPayload
) {
  ipcRenderer.send(ElectronAPIEventKeys.NativeNotify, payload)
}

/**
 * Opens a real OS context menu at the cursor and resolves with the chosen
 * item's id, or null if it was dismissed.
 */
export function popupContextMenu(
  items: Array<ContextMenuRequestItem>
): Promise<string | null> {
  const requestId = `ctx-${Date.now()}-${Math.random().toString(16).slice(2)}`

  return new Promise((resolve) => {
    let settled = false

    const listener = (
      _: IpcRendererEvent,
      payload: { itemId: string; requestId: string }
    ) => {
      if (payload.requestId !== requestId) {
        return
      }

      settled = true
      ipcRenderer.removeListener(
        ElectronAPIEventKeys.ContextMenuSelected,
        listener
      )
      resolve(payload.itemId)
    }

    ipcRenderer.on(ElectronAPIEventKeys.ContextMenuSelected, listener)
    ipcRenderer.send(ElectronAPIEventKeys.ContextMenuPopup, requestId, items)

    /**
     * `Menu.popup` reports a choice but never reports a dismissal, so the
     * listener would leak on every menu the user escapes out of. Menus are
     * modal and short-lived; a generous timeout cleans up without any risk of
     * racing a real selection.
     */
    setTimeout(() => {
      if (settled) {
        return
      }

      ipcRenderer.removeListener(
        ElectronAPIEventKeys.ContextMenuSelected,
        listener
      )
      resolve(null)
    }, 60_000)
  })
}

/**
 * Feeds the tray menu, which with the window hidden is the entire UI.
 */
export function setTraySummary(summary: {
  primaryName: string | null
  running: Array<string>
  total: number
}) {
  ipcRenderer.send(ElectronAPIEventKeys.TraySummary, summary)
}

/**
 * Fired when a jump-list entry asks the app to switch accounts.
 */
export function onScopeRequest(callback: (accountId: string) => void) {
  const customCallback = (_: IpcRendererEvent, accountId: string) => {
    callback(accountId)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.ScopeRequest,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.ScopeRequest,
        customCallback
      ),
  }
}
