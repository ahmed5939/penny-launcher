import { UpdateIcon } from '@radix-ui/react-icons'

import { Button } from '../../../components/ui/button'

import {
  useWorldInfo,
  useWorldInfoActions,
} from '../../../hooks/advanced-mode/world-info'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { cn } from '../../../lib/utils'

export function FetchAlertsButton() {
  const { isFetching, isReloading } = useWorldInfo()
  const { updateWorldInfoLoading } = useWorldInfoActions()
  const account = usePrimaryAccount()

  const fetchAlerts = () => {
    if (!account) {
      return
    }

    updateWorldInfoLoading('isReloading', true)
    window.electronAPI.requestHomeWorldInfo(account.accountId)
  }

  return (
    <Button
      className="ml-auto"
      variant="secondary"
      onClick={fetchAlerts}
      disabled={!account || isFetching || isReloading}
    >
      <span
        className={cn({
          'animate-spin': isReloading,
        })}
      >
        <UpdateIcon className="size-4" />
      </span>
    </Button>
  )
}
