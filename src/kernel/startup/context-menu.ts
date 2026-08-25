import type { MenuItemConstructorOptions, WebContents } from 'electron'

import { clipboard, Menu } from 'electron'

/**
 * One entry as the renderer describes it. Deliberately data-only: the renderer
 * says what the item is, the main process decides what a real menu looks like.
 */
export type ContextMenuRequestItem = {
  /** Sent back to the renderer when chosen. */
  id?: string
  label?: string
  enabled?: boolean
  /** Handled here rather than round-tripping through the renderer. */
  copy?: string
  type?: 'normal' | 'separator'
}

/**
 * Native right-click menus.
 *
 * An HTML context menu is the single loudest "this is a web page" tell there
 * is — wrong font, wrong corner radius, no acrylic, no keyboard behaviour, and
 * it clips at the window edge instead of flipping like every real menu does.
 * This hands the job to the OS and reports the chosen id back.
 */
export class NativeContextMenu {
  static popup(
    sender: WebContents,
    requestId: string,
    items: Array<ContextMenuRequestItem>,
  ) {
    const template: Array<MenuItemConstructorOptions> = items.map((item) => {
      if (item.type === 'separator') {
        return { type: 'separator' }
      }

      return {
        label: item.label ?? '',
        enabled: item.enabled !== false,
        click: () => {
          if (item.copy !== undefined) {
            clipboard.writeText(item.copy)
          }

          if (item.id && !sender.isDestroyed()) {
            sender.send('context-menu:selected', {
              itemId: item.id,
              requestId,
            })
          }
        },
      }
    })

    if (template.length === 0) {
      return
    }

    Menu.buildFromTemplate(template).popup()
  }
}
