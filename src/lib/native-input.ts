/**
 * Browser input defaults that have no place in a desktop window.
 *
 * Both are handled on `window` in the bubble phase, after every component has
 * had its turn, so a canvas that zooms on Ctrl+wheel or a real drop target
 * keeps working — this only catches what nothing else claimed.
 */
export function installNativeInput() {
  /**
   * Ctrl+wheel scales the whole page, chrome and all, and nothing puts it
   * back — there is no zoom menu or Ctrl+0 to find. No Windows app rescales
   * its own title bar because the user scrolled while holding Ctrl.
   */
  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey && !event.defaultPrevented) {
        event.preventDefault()
      }
    },
    { passive: false },
  )

  /**
   * A file dragged over the window gets the browser's "copy" cursor, and
   * letting go would navigate to it. Unclaimed drags show "no drop" instead,
   * which is what a window that accepts nothing looks like.
   */
  window.addEventListener('dragover', (event) => {
    if (event.defaultPrevented) {
      return
    }

    event.preventDefault()

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none'
    }
  })

  window.addEventListener('drop', (event) => {
    if (!event.defaultPrevented) {
      event.preventDefault()
    }
  })
}
