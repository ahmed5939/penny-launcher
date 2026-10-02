import type { SegmentedOption } from '../../components/page'
import type { AccountPlaytime } from '../playtime/model'
import type { AccountLibraryOverview, CollectionGame, CollectionSort } from './collection'
import type { LibraryArt, LibraryMode } from './model'

import { useMemo, useState } from 'react'
import { Gamepad2, Play } from 'lucide-react'

import stwFallbackArt from '../../../assets/images/backdrops/key-storm-warning.webp'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import { AnimatedNumber, EmptyState, Panel, PanelBody, PanelFooter, PanelHeader, Segmented, StatRow, StatTile } from '../../components/page'
import { Button } from '../../components/ui/button'

import { useGetAccounts } from '../../hooks/accounts'

import { formatPlaytime, fortniteAppName, fortniteSeconds } from '../playtime/model'
import { founderEdition } from './account'
import { buildCollection, modeTimes, sortCollection } from './collection'
import { GameDialog, ModeDialog } from './collection-dialogs'
import { FreeGamesPanel } from './free-games-panel'
import { Art, tall, wide } from './parts'

import { toast } from '../../lib/notifications'
import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * Every linked account's library as one: Fortnite and each account's stake
 * in it, the modes with a Play button per account, every game any account
 * owns, and this week's free games against all of them.
 */

const sorts: Array<SegmentedOption<CollectionSort>> = [
  { value: 'played', label: 'Most played' },
  { value: 'recent', label: 'Recently added' },
  { value: 'name', label: 'A to Z' },
]

type Props = {
  fortnite: { art: LibraryArt; modes: Array<LibraryMode> } | null
  isReading: boolean
  overviews: Record<string, AccountLibraryOverview | undefined>
  playtime: Record<string, AccountPlaytime | undefined>
}

export function CollectionView({ fortnite, isReading, overviews, playtime }: Props) {
  const { idsList } = useGetAccounts()
  const { games, tools } = useMemo(
    () => buildCollection({ accountIds: idsList, overviews, playtime }),
    [idsList, overviews, playtime]
  )
  const onPc = idsList.reduce((sum, id) => {
    const entry = playtime[id]

    return entry?.status === 'ok' ? sum + fortniteSeconds(entry.entries) : sum
  }, 0)
  const everywhere = idsList.reduce((sum, id) => sum + (playtime[id]?.allPlatforms?.minutes ?? 0) * 60, 0)
  const read = idsList.filter((id) => overviews[id]).length

  return (
    <div className="space-y-5">
      <StatRow>
        <StatTile hint={read < idsList.length ? `Reading ${idsList.length - read} more…` : 'Linked to Penny'} label="Accounts" value={idsList.length} />
        <StatTile
          hint="Every mode, all accounts"
          label="Fortnite on PC"
          value={
            onPc > 0 ? (
              <>
                <AnimatedNumber value={Math.round(onPc / 3600)} /> h
              </>
            ) : (
              '—'
            )
          }
        />
        <StatTile hint="BR and islands, all accounts" label="Every platform" value={everywhere > 0 ? formatPlaytime(everywhere) : '—'} />
        <StatTile hint="Outside Fortnite, no repeats" label="Epic games" value={games.length} />
      </StatRow>

      <FortniteHero fortnite={fortnite} overviews={overviews} playtime={playtime} />
      {fortnite && <ModesShelf fortnite={fortnite} overviews={overviews} playtime={playtime} />}
      <GamesShelf games={games} isReading={isReading} tools={tools} />
      <FreeGamesPanel overviews={overviews} />
    </div>
  )
}

/** Fortnite's art behind every account's stake in it: Save the World, hours, and a Play button. */
function FortniteHero({ fortnite, overviews, playtime }: Omit<Props, 'isReading'>) {
  const { accountList, idsList } = useGetAccounts()
  const art = (fortnite && wide(fortnite.art, 1600)) ?? stwFallbackArt

  return (
    <Panel className="relative">
      <img alt="" className="absolute inset-0 size-full object-cover object-[center_30%] opacity-50" decoding="async" src={art} />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-card/20" />
      <div className="relative space-y-4 px-6 py-5">
        <div>
          <p className="micro-label">Fortnite</p>
          <p className="text-display-sm font-bold leading-tight">Your accounts</p>
        </div>
        <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
          {idsList.map((id) => {
            const name = parseCustomDisplayName(accountList[id])
            const access = overviews[id]?.access ?? null
            const entry = playtime[id]
            const stw = access
              ? access.campaignAccess
                ? access.founderTier !== null
                  ? `${founderEdition(access.founderTier) ?? ''} Founder`.trim()
                  : 'Save the World'
                : 'No Save the World'
              : null
            const hours = [
              entry?.status === 'ok' ? `${formatPlaytime(fortniteSeconds(entry.entries))} PC` : null,
              entry?.allPlatforms ? `${formatPlaytime(entry.allPlatforms.minutes * 60)} all platforms` : null,
            ].filter(Boolean)

            return (
              <li className="flex items-center gap-3" key={id}>
                <AccountAvatar accountId={id} name={name} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui font-semibold">{name}</span>
                  <span className={cn('block truncate text-xs', access?.campaignAccess ? 'text-success' : 'text-muted-foreground')}>
                    {stw ?? (overviews[id] ? 'Save the World unknown' : 'Reading…')}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{hours.join(' · ') || ' '}</span>
                </span>
                <Button
                  aria-label={`Play Fortnite on ${name}`}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.electronAPI.launcherStartMode(id, null)
                    toast.info(`Starting Fortnite on ${name}…`)
                  }}
                >
                  <Play className="size-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      </div>
    </Panel>
  )
}

function ModesShelf({ fortnite, overviews, playtime }: Omit<Props, 'isReading' | 'fortnite'> & { fortnite: NonNullable<Props['fortnite']> }) {
  const { idsList } = useGetAccounts()
  const [opened, setOpened] = useState<LibraryMode | null>(null)
  const whole: LibraryMode = {
    catalogItemId: fortniteAppName,
    title: 'Fortnite',
    art: fortnite.art,
    appIds: [fortniteAppName],
    saveTheWorld: false,
    island: null,
  }
  const tiles = [whole, ...fortnite.modes].map((mode) => {
    const times = modeTimes(mode, idsList, playtime)
    const total = times.reduce((sum, time) => sum + (time.seconds ?? 0), 0)

    return { mode, total, played: times.filter((time) => time.seconds !== null).length }
  })

  return (
    <Panel>
      <PanelHeader description="Pick a mode to start straight into it, on any account." title="Modes" />
      <PanelBody>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
          {tiles.map(({ mode, played, total }, index) => (
            <li key={mode.catalogItemId}>
              <button
                className={cn(
                  'group relative block aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted/30 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  index === 0 && 'ring-2 ring-primary/60'
                )}
                type="button"
                onClick={() => setOpened(mode)}
              >
                <Art className="absolute inset-0 size-full transition-transform group-hover:scale-[1.04]" fallback={Gamepad2} src={tall(mode.art)} />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2.5 pb-2 pt-8">
                  <span className="block text-ui font-semibold leading-tight text-white">{mode.title}</span>
                  <span className={cn('mt-0.5 block text-caption', total > 0 ? 'figure font-semibold text-white' : 'text-white/60')}>
                    {total > 0
                      ? `${formatPlaytime(total)}${index === 0 ? ' on PC' : ''}${played > 1 ? ` · ${played} accounts` : ''}`
                      : 'Play'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PanelBody>
      {opened && <ModeDialog mode={opened} onClose={() => setOpened(null)} overviews={overviews} playtime={playtime} />}
    </Panel>
  )
}

function GamesShelf({ games, isReading, tools }: { games: Array<CollectionGame>; isReading: boolean; tools: Array<string> }) {
  const { accountList } = useGetAccounts()
  const [sort, setSort] = useState<CollectionSort>('played')
  const [opened, setOpened] = useState<CollectionGame | null>(null)
  const sorted = useMemo(() => sortCollection(games, sort), [games, sort])

  return (
    <Panel>
      <PanelHeader actions={<Segmented onChange={setSort} options={sorts} value={sort} />} title="Games" />
      <PanelBody>
        {sorted.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-4 gap-y-5">
            {sorted.map((game) => (
              <li key={game.namespace}>
                <button className="group block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" type="button" onClick={() => setOpened(game)}>
                  <span className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-muted/30">
                    <Art className="size-full transition-transform group-hover:scale-[1.03]" fallback={Gamepad2} src={tall(game.art)} />
                    <span className="absolute bottom-2 left-2 flex -space-x-1.5">
                      {game.owners.map((owner) => (
                        <AccountAvatar
                          accountId={owner.accountId}
                          className="ring-2 ring-black/60"
                          key={owner.accountId}
                          name={parseCustomDisplayName(accountList[owner.accountId])}
                          size="xs"
                        />
                      ))}
                    </span>
                  </span>
                  <span className="mt-2 block truncate text-ui font-semibold leading-tight">{game.title}</span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">
                      {game.owners.length > 1 ? `${game.owners.length} accounts` : parseCustomDisplayName(accountList[game.owners[0]?.accountId])}
                    </span>
                    {game.seconds !== null && <span className="figure shrink-0 font-semibold text-foreground/90">{formatPlaytime(game.seconds)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-8"
            icon={Gamepad2}
            title={isReading ? 'Reading your libraries…' : 'No games outside Fortnite'}
          />
        )}
      </PanelBody>
      {tools.length > 0 && (
        <PanelFooter>
          <span className="text-xs text-muted-foreground">Also in your libraries, not games: {tools.join(', ')}.</span>
        </PanelFooter>
      )}
      {opened && <GameDialog game={opened} onClose={() => setOpened(null)} />}
    </Panel>
  )
}
