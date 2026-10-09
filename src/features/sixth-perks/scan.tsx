import type { SixthPerksScan } from './types'

import { Callout, RefreshButton } from '../../components/page'
import { Label } from '../../components/ui/label'
import { Switch } from '../../components/ui/switch'

import { useGetSelectedAccount } from '../../hooks/accounts'
import { currentSession, useSixthPerksStore } from '../../state/stw-operations/sixth-perks'

export type SixthPerksScanState = {
  accountId: string | null
  includeBook: boolean
  scan: SixthPerksScan | null
  loading: boolean
  error: string | null
  rescan: () => void
  setIncludeBook: (enabled: boolean) => void
}

/** The selected account's scan for the current Collection Book setting. Both pages read it. */
export function useSixthPerksScan(): SixthPerksScanState {
  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null
  const includeBook = useSixthPerksStore((state) => state.includeBook)
  const session = useSixthPerksStore((state) => currentSession(state, accountId))
  const scan = useSixthPerksStore((state) => state.scan)
  const setIncludeBook = useSixthPerksStore((state) => state.setIncludeBook)

  return {
    accountId,
    includeBook,
    scan: session?.scan ?? null,
    loading: session?.loading ?? false,
    error: session?.error ?? null,
    rescan: () => {
      if (accountId) void scan(accountId)
    },
    setIncludeBook,
  }
}

/** The Collection Book switch and Scan, for either page's header. */
export function ScanActions({ state }: { state: SixthPerksScanState }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <Switch checked={state.includeBook} disabled={state.loading} id="sixth-perks-book" onCheckedChange={state.setIncludeBook} />
        <Label className="text-ui text-muted-foreground" htmlFor="sixth-perks-book">Collection Book</Label>
      </span>
      <RefreshButton disabled={!state.accountId} label={state.scan ? 'Rescan' : 'Scan'} loading={state.loading} onClick={state.rescan} />
    </>
  )
}

/** No account, a failed scan, a profile that could not be read. */
export function ScanNotices({ state }: { state: SixthPerksScanState }) {
  const { scan } = state
  const failed = scan ? [scan.inventory.status === 'error' && 'inventory schematics', scan.book.status === 'error' && 'Collection Book'].filter(Boolean) : []

  return (
    <>
      {!state.accountId && <Callout tone="info">Select an account in the title bar to check its schematics.</Callout>}
      {state.error && (
        <div role="alert">
          <Callout title="Scan failed" tone="danger">{state.error}</Callout>
        </div>
      )}
      {failed.length > 0 && (
        <Callout title="Partial results" tone="warning">
          Could not read your {failed.join(' or ')}, so {failed.length > 1 ? 'their' : 'its'} perks show as unknown. Rescan to retry.
        </Callout>
      )}
    </>
  )
}
