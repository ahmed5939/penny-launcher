import { useMemo } from 'react'

import { useGetAccounts } from '../../hooks/accounts'
import { useLibraryOverview } from '../../state/accounts/library-overview'
import { useAccountPlaytime } from '../../state/accounts/playtime'
import { useRewindFacts } from '../../state/accounts/rewind-facts'

import { buildRewind, rewindReady } from './model'

import { parseCustomDisplayName } from '../../lib/utils'

/** Save the World's content app: where its hours are when the catalogue has not answered. */
const fallbackSaveTheWorldApps = ['aa31f9e94e844b299ca757d1d0b97a09']

/**
 * The Rewind's facts, read on demand: opening it starts the playtime and
 * library reads for every account (each answered as it lands), and the
 * story waits until all of them have answered.
 */
export function useRewind({ enabled = true } = {}) {
  const { accountList, idsList } = useGetAccounts()
  const playtime = useAccountPlaytime({ enabled })
  const overview = useLibraryOverview({ enabled })
  const facts = useRewindFacts({ enabled })
  const accounts = useMemo(
    () =>
      idsList
        .filter((id) => accountList[id])
        .map((id) => ({ id, name: parseCustomDisplayName(accountList[id]) })),
    [accountList, idsList]
  )
  const saveTheWorldApps =
    overview.last?.fortnite?.modes.find((mode) => mode.saveTheWorld)?.appIds ?? fallbackSaveTheWorldApps
  const input = useMemo(
    () => ({ accounts, facts: facts.accounts, overviews: overview.accounts, playtime: playtime.accounts, saveTheWorldApps }),
    [accounts, facts.accounts, overview.accounts, playtime.accounts, saveTheWorldApps]
  )

  return {
    answered: accounts.filter(({ id }) => overview.accounts[id] && playtime.accounts[id] && facts.accounts[id]).length,
    checking: playtime.isChecking || overview.isChecking || facts.isChecking,
    ready: rewindReady(input),
    rewind: useMemo(() => buildRewind(input), [input]),
    total: accounts.length,
  }
}
