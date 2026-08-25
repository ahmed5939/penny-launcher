import type { WindowChromeState } from '../../types/window'

import { useEffect, useState } from 'react'

const initialState: WindowChromeState = {
  maximized: false,
  mica: false,
  titleBarHeight: 40,
}

/**
 * Mirrors the main process's chrome state onto the document element.
 *
 * Two classes come out of this. `mica` lets the shell go translucent so the
 * Windows 11 backdrop material shows through the titlebar and rail — without
 * it those surfaces stay opaque, because Mica is not available on Windows 10
 * and a see-through app on a solid black base just looks broken. `maximized`
 * drops the window's rounded corners and outer hairline, which Windows stops
 * drawing once the window fills the screen.
 */
export function useWindowChrome() {
  const [state, setState] = useState<WindowChromeState>(initialState)

  useEffect(() => {
    const listener = window.electronAPI.onWindowChromeState((value) => {
      setState(value)
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.toggle('mica', state.mica)
    root.classList.toggle('maximized', state.maximized)
    root.style.setProperty(
      '--header-height',
      `${state.titleBarHeight}px`
    )
  }, [state])

  return state
}
