import { RefreshButton } from '../../../components/page'

import {
  useWorldInfo,
  useWorldInfoActions,
} from '../../../hooks/advanced-mode/world-info'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

/**
 * Re-reads today's world info. The kit's Refresh, so it says what it does
 * rather than being a lone spinning glyph at the end of the title row.
 */
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
    <RefreshButton
      disabled={!account || isFetching}
      loading={isReloading}
      onClick={fetchAlerts}
    />
  )
}
