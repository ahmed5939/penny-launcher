import { useGetSelectedAccount } from '../accounts'
import { useGameInstall } from '../game-install'
import { useCustomProcessStatus } from '../settings'

/** Shared launch and close eligibility for the titlebar, Home and palette. */
export function useGameAction({ autoLoad = false } = {}) {
  const { selected } = useGetSelectedAccount()
  const { status } = useGameInstall({ autoLoad })
  const { customProcessIsRunning: isRunning } = useCustomProcessStatus()
  const canLaunch =
    selected !== null &&
    selected.authStatus !== 'invalid' &&
    !isRunning &&
    status?.install.found !== false

  return {
    isRunning,
    canLaunch,
    launch: () => {
      if (canLaunch && selected) window.electronAPI.launcherStart(selected)
    },
    close: () => {
      if (isRunning) window.electronAPI.killProcess()
    },
  }
}
