import type {
  LeaderboardMetric,
  LeaderboardRow,
} from '../../../kernel/core/leaderboard-parse'

import { useEffect, useMemo, useState } from 'react'

import { useAccountListStore } from '../../../state/accounts/list'

export function useLeaderboardData() {
  const [metric, setMetric] = useState<LeaderboardMetric>('power_level')
  const [rows, setRows] = useState<Array<LeaderboardRow>>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const accounts = useAccountListStore((state) => state.accounts)

  const linkedDisplayNames = useMemo(() => {
    const names = new Set<string>()

    for (const account of Object.values(accounts)) {
      if (account.displayName) {
        names.add(account.displayName.toLowerCase())
      }
    }

    return names
  }, [accounts])

  useEffect(() => {
    const listener = window.electronAPI.responseLeaderboard(
      async (response) => {
        if (response.metric !== metric) {
          return
        }

        setRows(response.rows)
        setErrorMessage(response.errorMessage ?? null)
        setIsLoading(false)
      }
    )

    // Clear the previous metric's rows so a metric switch shows the
    // loading skeleton instead of stale numbers under the new header.
    setRows([])
    setErrorMessage(null)
    setIsLoading(true)
    window.electronAPI.requestLeaderboard(metric)

    return () => {
      listener.removeListener()
    }
  }, [metric])

  const handleRefresh = () => {
    setIsLoading(true)
    window.electronAPI.requestLeaderboard(metric, true)
  }

  return {
    errorMessage,
    handleRefresh,
    isLoading,
    linkedDisplayNames,
    metric,
    rows,
    setMetric,
  }
}
