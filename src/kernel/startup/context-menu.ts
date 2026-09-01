import type {
  ContextMenuParams,
  MenuItemConstructorOptions,
  WebContents,
} from 'electron'

import { BrowserWindow, clipboard, Menu } from 'electron'

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
    let selected = false
    const template: Array<MenuItemConstructorOptions> = items.map((item) => {
      if (item.type === 'separator') {
        return { type: 'separator' }
      }

      return {
        label: item.label ?? '',
        enabled: item.enabled !== false,
        click: () => {
          selected = true
          if (item.copy !== undefined) {
            clipboard.writeText(item.copy)
          }

          if (!sender.isDestroyed()) {
            sender.send('context-menu:selected', {
              itemId: item.id ?? null,
              requestId,
            })
          }
        },
      }
    })

    if (template.length === 0) {
      return
    }

    Menu.buildFromTemplate(template).popup({
      window: BrowserWindow.fromWebContents(sender) ?? undefined,
      callback: () => {
        if (!selected && !sender.isDestroyed()) {
          sender.send('context-menu:selected', {
            itemId: null,
            requestId,
          })
        }
      },
    })
  }

  static popupEditable(sender: WebContents, params: ContextMenuParams) {
    if (!params.isEditable) {
      return false
    }

    const { editFlags } = params
    const template: Array<MenuItemConstructorOptions> = [
      { role: 'undo', enabled: editFlags.canUndo },
      { role: 'redo', enabled: editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: editFlags.canCut },
      { role: 'copy', enabled: editFlags.canCopy },
      { role: 'paste', enabled: editFlags.canPaste },
      { role: 'delete', enabled: editFlags.canDelete },
      { type: 'separator' },
      { role: 'selectAll', enabled: editFlags.canSelectAll },
    ]

    Menu.buildFromTemplate(template).popup({
      window: BrowserWindow.fromWebContents(sender) ?? undefined,
    })

    return true
  }
}
