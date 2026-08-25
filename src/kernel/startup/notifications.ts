import path from 'node:path'
import { app, Notification } from 'electron'

import { MainWindow } from './windows/main'

export type NativeNotificationPayload = {
  body: string
  /** Bring the window forward when the toast is clicked. */
  focusOnClick?: boolean
  silent?: boolean
  title: string
}

/**
 * Real Windows toasts, as opposed to the in-app ones.
 *
 * Penny's whole point is running unattended — auto-kick, the taxi service and
 * auto-llamas all tick with the window minimised to tray. An in-app Sonner
 * toast fires into a void in exactly that situation, which is the only
 * situation where being told mattered. A shell notification lands in Action
 * Centre and is still there an hour later.
 */
export class NativeNotifications {
  private static get icon() {
    return path.join(app.getAppPath(), 'icon-transparent.png')
  }

  static get isSupported() {
    return Notification.isSupported()
  }

  static send({
    body,
    focusOnClick = true,
    silent = false,
    title,
  }: NativeNotificationPayload) {
    if (!NativeNotifications.isSupported) {
      return
    }

    try {
      const notification = new Notification({
        body,
        icon: NativeNotifications.icon,
        silent,
        title,
      })

      if (focusOnClick) {
        notification.on('click', () => {
          const window = MainWindow.instance

          if (!window || window.isDestroyed()) {
            return
          }

          if (!window.isVisible()) {
            window.show()
          }

          if (window.isMinimized()) {
            window.restore()
          }

          window.focus()
        })
      }

      notification.show()

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Notifications can be disabled per-app in Windows settings.
    }
  }
}
