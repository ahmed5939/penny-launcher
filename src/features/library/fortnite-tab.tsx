import type { SaveTheWorldStatus } from './account'
import type { ItemKind, LibraryArt, LibraryMode, LibraryPurchase } from './model'

import { Gamepad2, Package } from 'lucide-react'

import stwFallbackArt from '../../../assets/images/backdrops/key-storm-warning.webp'

import { Chip, EmptyState, ListRow, Panel, PanelBody, PanelHeader, PanelSectionHeader } from '../../components/page'

import { formatPlaytime, fortniteAppName } from '../playtime/model'
import { timeFor } from './account'
import { Art, day, tall, wide } from './parts'

import { relativeTime } from '../../lib/dates'
import { cn } from '../../lib/utils'

/**
 * The Fortnite tab: Save the World first (what most people open the page
 * for), then every mode with the time Epic recorded in it, then everything
 * else Fortnite has granted the account — sorted into what was bought, what
 * was earned, and what it unlocks.
 */

const kindLabels: Record<ItemKind, string> = {
  vbucks: 'V-Bucks',
  pack: 'Pack',
  subscription: 'Subscription',
  access: 'Access',
  other: 'Item',
}

/** Save the World's status over its key art: unlocked or not, Founder or not, and the hours. */
export function SaveTheWorldLine({
  saveTheWorld,
  seconds,
}: {
  saveTheWorld: SaveTheWorldStatus
  /** Time on Save the World's records, null when there is none (or not yet read). */
  seconds: number | null
}) {
  const { access, founder, founderSince, source, tutorialComplete } = saveTheWorld
  const art = wide(saveTheWorld.art, 1280) ?? stwFallbackArt
  const title =
    access === true
      ? founder
        ? `${founder.edition ? `${founder.edition} ` : ''}Founder`
        : 'Save the World unlocked'
      : access === false
        ? 'Save the World is locked'
        : 'Save the World access unknown'
  const details = [
    access === true && founder ? 'Save the World unlocked' : null,
    founderSince ? `Founder since ${day(founderSince)} · ${relativeTime(founderSince)}` : null,
    seconds !== null ? `${formatPlaytime(seconds)} recorded` : null,
    access === true && !tutorialComplete && source === 'profile' ? 'Tutorial not finished' : null,
  ].filter(Boolean)

  return (
    <Panel className="relative">
      <img
        alt=""
        className={cn(
          'absolute inset-0 size-full object-cover object-[center_35%]',
          access === false ? 'opacity-30 grayscale' : 'opacity-60'
        )}
        decoding="async"
        src={art}
      />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-card via-card/70 to-card/10" />
      <div className="relative flex min-h-36 flex-wrap items-end justify-between gap-4 px-6 py-5">
        <div className="min-w-0 max-w-xl space-y-1.5">
          <p className="micro-label">Save the World</p>
          <p className="text-display-sm font-bold leading-tight">{title}</p>
          {details.length > 0 && <p className="text-ui text-foreground/80">{details.join(' · ')}</p>}
          {source === 'entitlements' && (
            <p className="text-xs text-muted-foreground">
              From entitlements — the game profile didn't load.
            </p>
          )}
          {source === null && (
            <p className="text-xs text-muted-foreground">
              Couldn't check. Try Refresh.
            </p>
          )}
        </div>
        <Chip tone={access === true ? 'success' : access === false ? 'neutral' : 'warning'}>
          {access === true ? 'Unlocked' : access === false ? 'Locked' : 'Unknown'}
        </Chip>
      </div>
    </Panel>
  )
}

/**
 * Fortnite as a whole first — where most accounts' hours are — then every
 * mode with a record of its own, then the rest.
 */
export function ModesPanel({
  art,
  modes,
  seconds,
}: {
  art: LibraryArt
  modes: Array<LibraryMode>
  seconds: Map<string, number> | null
}) {
  const total = seconds ? timeFor([fortniteAppName], seconds) : null
  const timed = modes
    .map((mode, index) => ({ mode, index, time: seconds ? timeFor(mode.appIds, seconds) : null }))
    .sort((a, b) => (b.time ?? -1) - (a.time ?? -1) || a.index - b.index)
  const played = timed.filter((entry) => entry.time !== null).length

  return (
    <Panel>
      <PanelHeader
        actions={
          seconds && modes.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              Separate records for <span className="figure text-foreground">{played}</span> of <span className="figure">{modes.length}</span> modes
            </span>
          ) : null
        }
        description="Time started from Fortnite itself counts toward Fortnite, not the mode."
        title="Fortnite and its modes"
      />
      <PanelBody>
        {modes.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
            <li>
              <ModeTile
                lead
                mode={{ catalogItemId: fortniteAppName, title: 'Fortnite', art, appIds: [fortniteAppName], saveTheWorld: false, island: null }}
                reading={seconds === null}
                time={total}
              />
            </li>
            {timed.map(({ mode, time }) => (
              <li key={mode.catalogItemId}>
                <ModeTile mode={mode} reading={seconds === null} time={time} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-8"
            description="The Epic catalogue did not answer, so the modes cannot be listed. Try Refresh."
            icon={Gamepad2}
            title="Modes unavailable"
          />
        )}
      </PanelBody>
    </Panel>
  )
}

function ModeTile({
  lead = false,
  mode,
  reading,
  time,
}: {
  /** The whole game: its figure is the one that counts most. */
  lead?: boolean
  mode: LibraryMode
  reading: boolean
  time: number | null
}) {
  return (
    <figure
      className={cn('relative aspect-[3/4] overflow-hidden rounded-lg bg-muted/30', lead && 'ring-2 ring-primary/60')}
      title={mode.title}
    >
      <Art className="absolute inset-0 size-full" fallback={Gamepad2} src={tall(mode.art)} />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2.5 pb-2 pt-8">
        <span className="block text-ui font-semibold leading-tight text-white">{mode.title}</span>
        <span
          className={cn(
            'mt-0.5 block',
            time !== null ? 'figure font-semibold text-white' : 'text-caption text-white/60',
            time !== null && (lead ? 'text-title' : 'text-caption')
          )}
        >
          {time !== null
            ? `${formatPlaytime(time)}${lead ? ' on PC' : ' recorded'}`
            : reading
              ? 'Reading time…'
              : lead
                ? 'No time recorded'
                : 'No separate record'}
        </span>
      </figcaption>
    </figure>
  )
}

/** Everything else on the account, in three lists. */
export function GrantsPanel({ purchases }: { purchases: Array<LibraryPurchase> }) {
  const bought = purchases.filter((item) => item.group === 'purchase')
  const rewards = purchases.filter((item) => item.group === 'reward')
  const access = purchases.filter((item) => item.group === 'access')

  return (
    <Panel>
      <PanelHeader
        description="Everything else Fortnite has given this account."
        title="Purchases and rewards"
      />
      {purchases.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-8"
          description="This account has no Fortnite entitlements besides its modes."
          icon={Package}
          title="Nothing else here"
        />
      ) : (
        <PanelBody className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-6">
            <GrantList
              empty="Nothing bought through Epic on this account."
              items={bought}
              title="Purchases"
            />
            <GrantList items={access} title="Access" />
          </div>
          <GrantList
            empty="No rewards or promotions on this account."
            items={rewards}
            title="Rewards and promotions"
          />
        </PanelBody>
      )}
    </Panel>
  )
}

function GrantList({ empty, items, title }: { empty?: string; items: Array<LibraryPurchase>; title: string }) {
  if (items.length === 0 && !empty) {
    return null
  }

  // A column of blank squares says nothing; thumbnails only where some exist.
  const withArt = items.some((item) => item.art.tall || item.art.wide)

  return (
    <div className="min-w-0">
      <PanelSectionHeader
        actions={<span className="figure text-xs text-muted-foreground">{items.length}</span>}
        className="px-0"
        title={title}
      />
      {items.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/30">
          {items.map((item) => (
            <ListRow
              caption={grantCaption(item)}
              className={cn(!item.active && 'opacity-60')}
              figure={item.count > 1 ? `×${item.count}` : undefined}
              key={item.catalogItemId || item.entitlementName}
              name={item.title}
              well={withArt ? <Thumb item={item} /> : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function grantCaption(item: LibraryPurchase) {
  const when =
    item.group === 'access'
      ? item.grantDate && `Since ${day(item.grantDate)}`
      : item.count > 1 && item.lastGrantDate !== item.grantDate
        ? `First ${day(item.grantDate)}, last ${day(item.lastGrantDate)}`
        : day(item.grantDate)

  return [
    item.group === 'reward' ? item.source : item.group === 'purchase' ? kindLabels[item.kind] : null,
    when,
    item.internalName && item.group !== 'access' ? `Epic's name: ${item.internalName}` : null,
    item.active ? null : 'Inactive',
  ]
    .filter(Boolean)
    .join(' · ')
}

function Thumb({ item }: { item: LibraryPurchase }) {
  const src = tall(item.art, 60)

  return src ? (
    <img alt="" className="aspect-[3/4] h-10 shrink-0 rounded object-cover" decoding="async" loading="lazy" src={src} />
  ) : (
    <span className="aspect-[3/4] h-10 shrink-0 rounded bg-muted" />
  )
}
