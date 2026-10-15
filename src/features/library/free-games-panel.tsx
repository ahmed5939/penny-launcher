import type { AccountLibraryOverview } from './collection'
import type { FreeGame } from './free-games'

import { useEffect, useState } from 'react'
import { ExternalLink, Gift } from 'lucide-react'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import { Callout, Chip, EmptyState, Panel, PanelBody, PanelHeader, PanelSectionHeader } from '../../components/page'
import { Button } from '../../components/ui/button'

import { useGetAccounts } from '../../hooks/accounts'

import { accountsOwning } from './collection'
import { createFreeGamesCache, type FreeGamesState } from './free-games-cache'
import { Art, tall } from './parts'

import { toast } from '../../lib/notifications'
import { parseCustomDisplayName } from '../../lib/utils'

/**
 * Epic's free games, against every linked account: which already have each
 * one, and a button per account that does not — opening the store page in
 * the browser already signed in as that account, ready to claim.
 */

const freeGames = createFreeGamesCache((refresh) => window.electronAPI.requestFreeGames(refresh))

/** Reloads the free games into every mounted panel, keeping the last list on screen until the new one lands. */
export function refreshFreeGames() {
  freeGames.refresh()
}

export function useFreeGames() {
  const [state, setState] = useState<FreeGamesState>({ data: null, error: false, loading: true })

  useEffect(() => {
    const unsubscribe = freeGames.subscribe((patch) => setState((current) => ({ ...current, ...patch })))

    freeGames.load()

    return unsubscribe
  }, [])

  return state
}

function weekday(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function FreeGamesPanel({
  overviews,
}: {
  overviews: Record<string, AccountLibraryOverview | undefined>
}) {
  const { data, error, loading } = useFreeGames()

  return (
    <Panel>
      <PanelHeader
        description="Claim on any account that doesn't have it yet."
        icon={Gift}
        title="Free on Epic"
      />
      {error ? (
        <PanelBody className="space-y-3">
          <Callout tone="warning">Could not load this week's free games.</Callout>
          <Button disabled={loading} onClick={() => refreshFreeGames()} size="sm" variant="outline">
            Try again
          </Button>
        </PanelBody>
      ) : !data ? (
        <PanelBody>
          <p className="text-ui text-muted-foreground" role="status">
            Loading free games…
          </p>
        </PanelBody>
      ) : data.now.length + data.next.length === 0 ? (
        <EmptyState className="border-0 bg-transparent py-8" icon={Gift} title="No giveaway this week" />
      ) : (
        <>
          {data.now.length > 0 && (
            <ul className="grid gap-4 px-5 py-4 md:grid-cols-2">
              {data.now.map((game) => (
                <li key={game.offerId}>
                  <FreeGameCard game={game} overviews={overviews} />
                </li>
              ))}
            </ul>
          )}
          {data.next.length > 0 && (
            <>
              <PanelSectionHeader className="px-5" title="Next week" />
              <ul className="flex flex-wrap gap-4 px-5 py-4">
                {data.next.map((game) => (
                  <li className="w-36" key={game.offerId}>
                    <span className="block aspect-[3/4] overflow-hidden rounded-lg bg-muted/30">
                      <Art className="size-full" fallback={Gift} src={tall(game.art)} />
                    </span>
                    <span className="mt-2 block truncate text-ui font-semibold">{game.title}</span>
                    <span className="block text-xs text-muted-foreground">Free from {weekday(game.startsAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  )
}

function FreeGameCard({
  game,
  overviews,
}: {
  game: FreeGame
  overviews: Record<string, AccountLibraryOverview | undefined>
}) {
  const { accountList, idsList } = useGetAccounts()
  const [opening, setOpening] = useState<string | null>(null)
  const read = idsList.filter((id) => overviews[id]?.status === 'ok')
  const owners = accountsOwning(game.namespace, read, overviews)
  const missing = read.filter((id) => !owners.includes(id))

  const claim = (accountId: string) => {
    if (!game.storeUrl) return

    setOpening(accountId)
    window.electronAPI
      .openStoreSignedIn(accountId, game.storeUrl)
      .then((result) =>
        result.ok
          ? toast.success(`Opened ${game.title} signed in as ${parseCustomDisplayName(accountList[accountId])}`)
          : toast.error(result.error)
      )
      .catch(() => toast.error('Could not open the store. Try again.'))
      .finally(() => setOpening(null))
  }

  return (
    <article className="flex gap-4">
      <span className="block aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-lg bg-muted/30">
        <Art className="size-full" fallback={Gift} src={tall(game.art, 260)} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-title font-semibold leading-tight">{game.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Free until {weekday(game.endsAt)}
            {game.regularPrice && (
              <>
                {' · '}
                <span className="line-through">{game.regularPrice}</span>
              </>
            )}
          </p>
        </div>

        {read.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {owners.length === read.length ? (
              <Chip tone="success">On every account</Chip>
            ) : owners.length > 0 ? (
              <>
                <span className="flex -space-x-1.5">
                  {owners.map((id) => (
                    <AccountAvatar accountId={id} className="ring-2 ring-card" key={id} name={parseCustomDisplayName(accountList[id])} size="xs" />
                  ))}
                </span>
                Already on {owners.length} of {read.length}
              </>
            ) : (
              <span>On none of your accounts yet</span>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!game.storeUrl && missing.length > 0 && (
            <span className="text-xs text-muted-foreground">Epic gave no store page for this game.</span>
          )}
          {game.storeUrl &&
            missing.map((id) => (
              <Button
                disabled={opening !== null}
                key={id}
                size="sm"
                variant={missing.length === 1 ? 'default' : 'outline'}
                onClick={() => claim(id)}
              >
                <AccountAvatar accountId={id} className="mr-2" name={parseCustomDisplayName(accountList[id])} size="xs" />
                {opening === id ? 'Opening…' : `Claim on ${parseCustomDisplayName(accountList[id])}`}
              </Button>
            ))}
          {game.storeUrl && missing.length === 0 && (
            <Button size="sm" variant="ghost" onClick={() => window.electronAPI.openExternalURL(game.storeUrl!)}>
              <ExternalLink className="mr-2 size-4" />
              Store page
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
