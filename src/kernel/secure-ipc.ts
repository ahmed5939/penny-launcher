import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'

import { ipcMain } from 'electron'

import { RuntimeLog } from './runtime-log'
import { isReasonableIpcPayload } from './security'
import { MainWindow } from './startup/windows/main'

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent

function isTrustedSender(event: IpcEvent) {
  const window = MainWindow.instance

  return (
    Boolean(window) &&
    !window.isDestroyed() &&
    event.sender.id === window.webContents.id
  )
}

// Handler signatures intentionally mirror Electron's variadic IPC API.
type Listener<Event extends IpcEvent> = (
  event: Event,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: Array<any>
) => unknown

export function secureIpcOn(channel: string, listener: Listener<IpcMainEvent>) {
  ipcMain.on(channel, (event, ...args) => {
    if (!isTrustedSender(event) || !isReasonableIpcPayload(args)) {
      RuntimeLog.error(
        `ipc-rejected:${channel}`,
        new Error('Untrusted sender or invalid payload.')
      )
      return
    }

    try {
      Promise.resolve(listener(event, ...args)).catch((error) => {
        RuntimeLog.error(`ipc:${channel}`, error)
      })
    } catch (error) {
      RuntimeLog.error(`ipc:${channel}`, error)
    }
  })
}

export function secureIpcHandle(
  channel: string,
  listener: Listener<IpcMainInvokeEvent>
) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event) || !isReasonableIpcPayload(args)) {
      RuntimeLog.error(
        `ipc-rejected:${channel}`,
        new Error('Untrusted sender or invalid payload.')
      )
      throw new Error('Request rejected.')
    }

    try {
      return await listener(event, ...args)
    } catch (error) {
      RuntimeLog.error(`ipc:${channel}`, error)
      throw new Error('Request failed.')
    }
  })
}
