import { useEffect, useState } from 'react'
import { useGetSelectedAccount } from '../../../hooks/accounts'
import { useInventoryStore } from '../../../state/stw-operations/inventory'
import { useItemDatabaseStore } from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { DefendersView } from './-view'

export function RouteComponent() {
  useRequestItemDatabase()
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null
  const entry = useInventoryStore(s => accountId ? s.data[accountId] : undefined)
  const updateData = useInventoryStore(s => s.updateData)
  const records = useItemDatabaseStore(s => s.records)
  const ratings = useItemDatabaseStore(s => s.ratings)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ account: string | null; loading: boolean; error: string | null }>({ account: null, loading: false, error: null })
  useEffect(() => {
    if (!selected || !accountId) return
    setState({ account: accountId, loading: true, error: null })
    let disposed = false
    const timer = setTimeout(() => {
      if (!disposed) setState({ account: accountId, loading: false, error: 'The inventory request timed out. Please try again.' })
    }, 30000)
    const listener = window.electronAPI.responseInventory(async response => {
      if (disposed || !response[accountId]) return
      clearTimeout(timer)
      updateData(response)
      setState({ account: accountId, loading: false, error: response[accountId].errorMessage ?? null })
    })
    try { window.electronAPI.requestInventory([selected]) }
    catch { clearTimeout(timer); setState({ account: accountId, loading: false, error: 'Could not request your inventory. Please try again.' }) }
    return () => { disposed = true; clearTimeout(timer); listener.removeListener() }
  }, [accountId, attempt])
  const loading = Boolean(accountId && (state.account !== accountId || state.loading))
  const error = state.account === accountId ? state.error : null
  return <DefendersView key={accountId ?? 'no-account'} accountSelected={Boolean(accountId)} loading={loading} error={error}
    items={!loading && !error ? entry?.items ?? [] : []} records={records} ratings={ratings} onRefresh={() => setAttempt(n => n + 1)} />
}
