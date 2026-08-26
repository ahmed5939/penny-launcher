import { useEffect, useRef, useState } from 'react'

import { pennyDBProfileURL } from '../../config/fortnite/links'

import { useGetSelectedAccount } from '../../hooks/accounts'
import { useCustomProcessStatus } from '../../hooks/settings'

export function useAttributesStates() {
  const [open, setOpen] = useState(false)
  const { selected } = useGetSelectedAccount()
  const { customProcessIsRunning } = useCustomProcessStatus()

  const isButtonDisabled = selected === null // || selected.accessToken === undefined

  return {
    customProcessIsRunning,
    isButtonDisabled,
    open,

    setOpen,
  }
}

/**
 * The launch-result toast that used to live here now mounts app-wide in
 * `bootstrap/components/launcher-notifications`, and the minimise/close
 * handlers are gone with the hand-drawn window buttons — Windows owns those
 * now, and the tray behaviour they carried moved onto the window's own
 * `minimize` and `close` events in the main process.
 */
export function useHandlers() {
  const { selected } = useGetSelectedAccount()

  const handleLaunch = () => {
    if (!selected) {
      return
    }

    window.electronAPI.launcherStart(selected)
  }

  const handleKillProcess = () => {
    window.electronAPI.killProcess()
  }

  const handleOpenPennyDBProfile = () => {
    if (!selected) {
      return
    }

    window.electronAPI.openExternalURL(
      pennyDBProfileURL(selected.accountId)
    )
  }

  return {
    handleKillProcess,
    handleLaunch,
    handleOpenPennyDBProfile,
  }
}

export function useWindowEvents() {
  const matchMediaRef = useRef(window.matchMedia('(min-width: 930px)'))
  const [isMinWith, setIsMinWith] = useState(
    !matchMediaRef.current.matches
  )

  useEffect(() => {
    const handler = (event: MediaQueryListEvent) => {
      setIsMinWith(!event.matches)
    }

    matchMediaRef.current.addEventListener('change', handler)

    return () => {
      matchMediaRef.current.removeEventListener('change', handler)
    }
  }, [])

  return {
    isMinWith,
  }
}
