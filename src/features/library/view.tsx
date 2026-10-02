import type { AccountResource, PickerOption, SegmentedOption } from '../../components/page'
import type { AccountPlaytime } from '../playtime/model'
import type {
  CloudSaveGame,
  CloudSavesDownloadProgress,
  CloudSavesResponse,
  LibraryOffer,
  LibraryResponse,
  LibraryStoreResponse,
  OfferKind,
} from './model'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CloudDownload, Coins, Download, LibraryBig, ShoppingBag } from 'lucide-react'

import {
  AccountResourceGate,
  Callout,
  Chip,
  EmptyState,
  FilterBar,
  PageHeader,
  PageTabPanel,
  PageTabs,
  Pager,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  Picker,
  ProgressBar,
  RefreshButton,
  SearchField,
  Segmented,
  StatRow,
  StatTile,
  ToolBadges,
  paginate,
  useAccountResource,
} from '../../components/page'
import { Button } from '../../components/ui/button'

import { useGetSelectedAccount } from '../../hooks/accounts'
import { useLibraryOverview } from '../../state/accounts/library-overview'
import { useAccountPlaytime } from '../../state/accounts/playtime'

import { formatPlaytime, fortniteSeconds } from '../playtime/model'
import { secondsByApp, timeFor } from './account'
import { RewindButton } from '../rewind/launch'
import { CollectionView } from './collection-view'
import { GrantsPanel, ModesPanel, SaveTheWorldLine } from './fortnite-tab'
import { formatBytes, offerOwned } from './model'
import { Art, day, tall } from './parts'

import { relativeTime } from '../../lib/dates'
import { toast } from '../../lib/notifications'
import { parseCustomDisplayName } from '../../lib/utils'

/**
 * The Library, every linked account at once.
 *
 * Collection is the launcher's own view: Fortnite and each account's stake
 * in it, the modes with Play buttons, every game any account owns, and the
 * week's free games against all of them. The selected account's tab holds
 * what only it has — Save the World's status, its modes' times, its
 * purchases and rewards. Store and Cloud saves are as Epic lists them.
 */

type TabId = 'collection' | 'account' | 'store' | 'saves'

const OFFERS_PAGE = 30

const offerKinds: Array<SegmentedOption<OfferKind | 'all'>> = [
  { value: 'all', label: 'All' },
  { value: 'vbucks', label: 'V-Bucks' },
  { value: 'pack', label: 'Packs' },
  { value: 'other', label: 'Other' },
]

type Listings = 'listed' | 'all'

const listingOptions: Array<PickerOption<Listings>> = [
  { value: 'listed', label: 'Store listings only' },
  { value: 'all', label: 'Include unlisted offers' },
]

function regionName(country: string) {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(country) ?? country
  } catch {
    return country
  }
}

export function LibraryPage() {
  /*
   * Refresh skips the main process's caches (catalogue, store prices); a
   * first load and F5 use them. The flag is read once by the next load.
   */
  const forceLibrary = useRef(false)
  const forceStore = useRef(false)
  const [tab, setTab] = useState<TabId>('collection')
  const { selected } = useGetSelectedAccount()
  const playtime = useAccountPlaytime()
  const overview = useLibraryOverview()
  const library = useAccountResource(
    (accountId) => {
      const refresh = forceLibrary.current

      forceLibrary.current = false

      return window.electronAPI.requestLibrary(accountId, refresh)
    },
    {
      cacheKey: 'account.library',
      fallbackError: 'Could not read the library. Try Refresh.',
      owner: (result) => result.accountId,
    }
  )
  const saves = useAccountResource(
    (accountId) => window.electronAPI.requestCloudSaves(accountId),
    {
      cacheKey: 'account.cloud-saves',
      fallbackError: 'Could not read the cloud saves. Try Refresh.',
      owner: (result) => result.accountId,
    }
  )
  /* Not account data, but read through the same hook so it loads, fails and refreshes like the rest. */
  const store = useAccountResource(
    () => {
      const refresh = forceStore.current

      forceStore.current = false

      return window.electronAPI.requestLibraryStore(refresh)
    },
    {
      cacheKey: 'library.store',
      fallbackError: 'Could not read the Epic Games Store. Try Refresh.',
    }
  )
  const ownedItemIds = useMemo(() => new Set(library.data?.fortnite.ownedItemIds ?? []), [library.data])

  const refresh = () => {
    forceLibrary.current = true
    forceStore.current = true
    library.refresh()
    saves.refresh()
    store.refresh()
    playtime.refresh()
    overview.refresh()
  }

  const tabs: Array<{ value: TabId; label: string }> = [
    { value: 'collection', label: 'Collection' },
    { value: 'account', label: selected ? parseCustomDisplayName(selected) : 'This account' },
    { value: 'store', label: 'Store' },
    { value: 'saves', label: saves.data ? `Cloud saves · ${saves.data.games.length}` : 'Cloud saves' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <RewindButton />
            <RefreshButton
              loading={library.loading || saves.loading || store.loading || playtime.isChecking || overview.isChecking}
              onClick={refresh}
            />
          </>
        }
        description="Every game and mode across your linked accounts."
        icon={LibraryBig}
        section="Account"
        status={<ToolBadges beta readOnly />}
        title="Library"
      />

      <PageTabs label="Library" onValueChange={setTab} tabs={tabs} value={tab}>
        <PageTabPanel activeValue={tab} value="collection">
          <CollectionView
            fortnite={overview.last?.fortnite ?? null}
            isReading={overview.isChecking}
            overviews={overview.accounts}
            playtime={playtime.accounts}
          />
        </PageTabPanel>

        <PageTabPanel activeValue={tab} value="account">
          <AccountResourceGate icon={LibraryBig} resource={library} what="the library">
            {(data) => (
              <AccountTab
                key={data.accountId}
                library={data}
                playtime={playtime.accounts[data.accountId] ?? null}
                saves={saves}
              />
            )}
          </AccountResourceGate>
        </PageTabPanel>

        <PageTabPanel activeValue={tab} value="store">
          <AccountResourceGate icon={ShoppingBag} resource={store} what="the store">
            {(data) => <StorePanel ownedItemIds={ownedItemIds} store={data} />}
          </AccountResourceGate>
        </PageTabPanel>

        <PageTabPanel activeValue={tab} value="saves">
          <AccountResourceGate icon={CloudDownload} resource={saves} what="the cloud saves">
            {(data) => <CloudSavesPanel key={data.accountId} saves={data} />}
          </AccountResourceGate>
        </PageTabPanel>
      </PageTabs>
    </div>
  )
}

/** What only the selected account has: Save the World's status, its modes' times, its grants. */
function AccountTab({
  library,
  playtime,
  saves,
}: {
  library: LibraryResponse
  playtime: AccountPlaytime | null
  saves: AccountResource<CloudSavesResponse>
}) {
  const { modes, purchases, saveTheWorld } = library.fortnite
  const seconds = useMemo(
    () => (playtime?.status === 'ok' ? secondsByApp(playtime.entries) : null),
    [playtime]
  )
  const stwMode = modes.find((mode) => mode.saveTheWorld)
  const stwSeconds = seconds && stwMode ? timeFor(stwMode.appIds, seconds) : null
  const saveTotals = saves.data
    ? {
        size: saves.data.games.reduce((sum, game) => sum + game.totalSize, 0),
        files: saves.data.games.reduce((sum, game) => sum + game.files.length, 0),
      }
    : null

  return (
    <div className="space-y-5">
      {library.errorMessage && (
        <Callout title="Part of the library could not be read" tone="warning">
          {library.errorMessage}
        </Callout>
      )}

      <StatRow>
        <StatTile
          hint={
            saveTheWorld.founder
              ? saveTheWorld.founderSince
                ? `Founder since ${day(saveTheWorld.founderSince)}`
                : "Founder's Pack"
              : saveTheWorld.access === null
                ? 'Could not be checked'
                : 'From the game profile'
          }
          label="Save the World"
          tone={saveTheWorld.access === true ? 'success' : 'default'}
          value={
            saveTheWorld.access === true
              ? saveTheWorld.founder
                ? `${saveTheWorld.founder.edition ?? ''} Founder`.trim()
                : 'Unlocked'
              : saveTheWorld.access === false
                ? 'Locked'
                : 'Unknown'
          }
        />
        <StatTile
          hint={
            playtime?.allPlatforms
              ? `On PC · ${formatPlaytime(playtime.allPlatforms.minutes * 60)} on every platform`
              : playtime?.status === 'unknown'
                ? 'Playtime unavailable'
                : 'On PC'
          }
          label="Time in Fortnite"
          value={playtime?.status === 'ok' ? formatPlaytime(fortniteSeconds(playtime.entries)) : playtime ? '—' : '…'}
        />
        <StatTile
          hint={library.games ? 'Besides Fortnite' : 'Could not be listed'}
          label="Other Epic games"
          value={library.games ? library.games.list.length.toLocaleString() : '—'}
        />
        <StatTile
          hint={saves.data && saveTotals ? `${saves.data.games.length} ${saves.data.games.length === 1 ? 'game' : 'games'} · ${saveTotals.files} files` : saves.error ? 'Could not be read' : 'Reading…'}
          label="Cloud saves"
          value={saveTotals ? formatBytes(saveTotals.size) : saves.error ? 'Unavailable' : '…'}
        />
      </StatRow>

      <SaveTheWorldLine saveTheWorld={saveTheWorld} seconds={stwSeconds} />
      <ModesPanel art={library.fortnite.art} modes={modes} seconds={seconds} />
      <GrantsPanel purchases={purchases} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function StorePanel({ ownedItemIds, store }: { ownedItemIds: ReadonlySet<string>; store: LibraryStoreResponse }) {
  const [kind, setKind] = useState<OfferKind | 'all'>('all')
  const [listings, setListings] = useState<Listings>('listed')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return store.offers.filter(
      (offer) =>
        (listings === 'all' || offer.listed) &&
        (kind === 'all' || offer.kind === kind) &&
        (needle === '' || offer.title.toLowerCase().includes(needle))
    )
  }, [store.offers, listings, kind, query])
  const owned = visible.filter((offer) => offerOwned(offer, ownedItemIds)).length
  const unlisted = store.offers.filter((offer) => !offer.listed).length
  const shown = paginate(visible, page, OFFERS_PAGE)

  return (
    <Panel>
      <PanelHeader
        actions={
          <Segmented
            onChange={(value) => { setKind(value); setPage(0) }}
            options={offerKinds}
            value={kind}
          />
        }
        description={`Fortnite's offers on the Epic Games Store, priced for ${regionName(store.country)}. ${owned > 0 ? `${owned} shown here ${owned === 1 ? 'is' : 'are'} already on this account.` : ''}`}
        title="Epic Games Store"
      />
      <FilterBar>
        <SearchField label="Search offers" onChange={(value) => { setQuery(value); setPage(0) }} placeholder="Offer name" value={query} />
        <Picker label="Listings" onChange={(value) => { setListings(value); setPage(0) }} options={listingOptions} value={listings} />
      </FilterBar>
      <PanelBody>
        {shown.items.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
            {shown.items.map((offer) => (
              <li key={offer.id}>
                <OfferCard offer={offer} owned={offerOwned(offer, ownedItemIds)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-8"
            description={store.offers.length === 0 ? 'The store returned no Fortnite offers.' : 'Nothing matches the search or filters.'}
            icon={ShoppingBag}
            title="No offers"
          />
        )}
      </PanelBody>
      <Pager onPageChange={setPage} page={shown.page} pageSize={OFFERS_PAGE} total={visible.length} />
      {listings === 'listed' && unlisted > 0 && (
        <PanelFooter>
          <span className="text-xs text-muted-foreground">
            <span className="figure">{unlisted}</span> older offers without store art — audiences, complimentary V-Bucks, retired bundles — are hidden. Choose "Include unlisted offers" to see them.
          </span>
        </PanelFooter>
      )}
    </Panel>
  )
}

function OfferCard({ offer, owned }: { offer: LibraryOffer; owned: boolean }) {
  const { price } = offer
  const ends = offer.expiryDate && Date.parse(offer.expiryDate) > Date.now() ? day(offer.expiryDate) : null
  const percent = price && price.discounted && price.original > 0
    ? Math.round((1 - price.discount / price.original) * 100)
    : null

  return (
    <article className="overflow-hidden rounded-lg bg-muted/25" title={offer.description ?? offer.title}>
      <div className="relative">
        <Art className="aspect-[3/4] w-full" fallback={offer.kind === 'vbucks' ? Coins : ShoppingBag} src={tall(offer.art)} />
        {owned && <Chip className="absolute left-2 top-2 bg-card/90" tone="success">Owned</Chip>}
      </div>
      <div className="space-y-1 px-3 pb-3 pt-2.5">
        <p className="line-clamp-2 text-ui font-semibold leading-tight">{offer.title}</p>
        <p className="flex flex-wrap items-baseline gap-x-2 text-ui">
          {price === null ? (
            <span className="text-xs text-muted-foreground">No price in this region</span>
          ) : price.free ? (
            <span className="font-semibold">Free</span>
          ) : (
            <>
              <span className="figure font-semibold">{price.formattedDiscount}</span>
              {price.discounted && <span className="figure text-xs text-muted-foreground line-through">{price.formattedOriginal}</span>}
              {percent !== null && <Chip tone="accent">−{percent}%</Chip>}
            </>
          )}
        </p>
        {ends && <p className="text-xs text-muted-foreground">Leaves the store {ends}</p>}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Cloud saves
// ---------------------------------------------------------------------------

function CloudSavesPanel({ saves }: { saves: CloudSavesResponse }) {
  const [running, setRunning] = useState<Record<string, CloudSavesDownloadProgress>>({})

  useEffect(() => {
    const listener = window.electronAPI.onCloudSavesDownloadProgress((progress) => {
      if (progress.accountId !== saves.accountId || progress.status !== 'running') return
      setRunning((current) => ({ ...current, [progress.appName]: progress }))
    })

    return () => {
      listener.removeListener()
    }
  }, [saves.accountId])

  const download = (game: CloudSaveGame) => {
    setRunning((current) => ({
      ...current,
      [game.appName]: { requestId: '', accountId: saves.accountId, appName: game.appName, status: 'running', done: 0, total: 0, bytes: 0, skipped: 0, directory: null },
    }))
    window.electronAPI
      .downloadCloudSaves(saves.accountId, game.appName)
      .then((result) => {
        const name = game.title ?? game.appName

        if (result.status === 'saved') {
          const written = result.done - result.skipped

          toast.success(`Saved ${written} ${written === 1 ? 'file' : 'files'} of ${name} to ${result.directory}${result.skipped > 0 ? ` — ${result.skipped} with unsafe names were left out` : ''}`)
        } else if (result.status === 'failed') {
          toast.error(`Could not copy ${name}'s cloud saves. ${result.errorMessage ?? ''}`.trim())
        }
      })
      .catch(() => toast.error('Could not copy the cloud saves. Try again.'))
      .finally(() => {
        setRunning((current) => {
          const next = { ...current }

          delete next[game.appName]

          return next
        })
      })
  }

  const { maxFileSizeBytes, maxFolderSizeBytes } = saves.limits
  const limits = [
    maxFileSizeBytes !== null ? `${formatBytes(maxFileSizeBytes)} per file` : null,
    maxFolderSizeBytes !== null ? `${formatBytes(maxFolderSizeBytes)} per game` : null,
  ].filter(Boolean)

  return (
    <>
      {saves.errorMessage && <Callout tone="warning">{saves.errorMessage}</Callout>}
      {saves.folderThrottled && (
        <Callout title="Epic is limiting this account's saves" tone="warning">
          The save store reports this account's folder as throttled, so new saves may be slow to sync for a while.
        </Callout>
      )}
      <Panel>
        <PanelHeader
          description="The saves Epic keeps for this account. Download a copy to any folder."
          title="Cloud saves"
        />
        {saves.games.length > 0 ? (
          <ul className="divide-y divide-border/40">
            {saves.games.map((game) => (
              <CloudSaveRow
                game={game}
                key={game.appName}
                onDownload={() => download(game)}
                progress={running[game.appName] ?? null}
              />
            ))}
          </ul>
        ) : (
          <PanelBody>
            <EmptyState
              className="border-0 bg-transparent py-8"
              description="None of this account's Epic games has synced a save to the cloud."
              icon={CloudDownload}
              title="No cloud saves"
            />
          </PanelBody>
        )}
        {limits.length > 0 && (
          <PanelFooter>
            <span className="text-xs text-muted-foreground">Epic's limits for this account: {limits.join(', ')}.</span>
          </PanelFooter>
        )}
      </Panel>
    </>
  )
}

function CloudSaveRow({
  game,
  onDownload,
  progress,
}: {
  game: CloudSaveGame
  onDownload: () => void
  progress: CloudSavesDownloadProgress | null
}) {
  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{game.title ?? game.appName}</p>
          {game.title && <p className="truncate font-mono text-xs text-muted-foreground">{game.appName}</p>}
        </div>
        <Figure label="Files" value={game.files.length.toLocaleString()} />
        <Figure label="Size" value={formatBytes(game.totalSize)} />
        <Figure label="Last sync" value={game.lastModified ? relativeTime(game.lastModified) : 'Unavailable'} />
        {game.downloadable ? (
          <Button disabled={progress !== null} onClick={onDownload} size="sm" variant="outline">
            <Download className="mr-2 size-3.5" />
            {progress ? 'Copying…' : 'Download a copy'}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No download link from Epic</span>
        )}
      </div>
      {progress && progress.total > 0 && (
        <div className="space-y-1">
          <ProgressBar label={`Copying ${game.title ?? game.appName}`} total={progress.total} value={progress.done} />
          <p className="text-xs text-muted-foreground">
            <span className="figure">{progress.done}</span> of <span className="figure">{progress.total}</span> files · {formatBytes(progress.bytes)}
          </p>
        </div>
      )}
      <details className="group">
        <summary className="w-fit select-none text-xs text-muted-foreground hover:text-foreground">
          {game.files.length === 1 ? 'Show the file' : `Show ${game.files.length} files`}
        </summary>
        <ul className="mt-2 space-y-1">
          {game.files.map((file) => (
            <li className="flex items-baseline gap-3 text-xs" key={file.path}>
              <span className="min-w-0 flex-1 truncate font-mono text-foreground/80">{file.path}</span>
              <span className="figure shrink-0 text-muted-foreground">{file.size !== null ? formatBytes(file.size) : '—'}</span>
              <span className="w-28 shrink-0 text-right text-muted-foreground">{day(file.lastModified) ?? 'Unavailable'}</span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20">
      <p className="micro-label">{label}</p>
      <p className="figure mt-1 text-ui font-semibold">{value}</p>
    </div>
  )
}
