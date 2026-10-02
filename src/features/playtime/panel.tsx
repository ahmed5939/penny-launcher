import type { LibraryArt } from '../library/model'
import type { OtherGameRow } from './achievements'
import type { AccountPlaytime, PlaytimeEntry } from './model'

import { useState } from 'react'
import { Clock } from 'lucide-react'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import {
  Callout,
  EmptyState,
  ListRow,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSectionHeader,
  RefreshButton,
  StatRow,
  StatTile,
} from '../../components/page'

import { useGetAccounts } from '../../hooks/accounts'
import { useAccountPlaytime } from '../../state/accounts/playtime'

import { sizedArt } from '../library/model'
import { achievementCaption, describeVisibility, otherGameRows } from './achievements'
import { AchievementsDialog } from './achievements-dialog'
import { formatPlaytime, fortniteSeconds, isFortniteEntry } from './model'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * Time played, for the account hub.
 *
 * Fortnite and its modes lead as a shelf of box art, the way a game library
 * shows what you play. Beside it (under it, on a narrow window) are the
 * account's other Epic games — with their Epic achievements, which open
 * into the full list — and, with more than one account linked, every
 * account's Fortnite hours, so they can be compared at a glance.
 */

type AccountRow = {
  id: string
  name: string
  entry: AccountPlaytime | undefined
  /** Fortnite seconds, or null when this account has not been read. */
  seconds: number | null
}

export function AccountPlaytimePanel({ accountId }: { accountId: string }) {
  const { accounts, isChecking, refresh } = useAccountPlaytime()
  const { accountList, idsList } = useGetAccounts()
  const entry = accounts[accountId]
  const ok = entry?.status === 'ok'
  const shelf = ok ? entry.entries.filter(isFortniteEntry) : []
  const others = ok ? otherGameRows(entry.entries, entry.achievements) : []
  const [opened, setOpened] = useState<{ accountId: string; row: OtherGameRow } | null>(null)
  const linked: Array<AccountRow> =
    idsList.length < 2
      ? []
      : idsList
          .filter((id) => accountList[id])
          .map((id) => ({
            id,
            name: parseCustomDisplayName(accountList[id]),
            entry: accounts[id],
            seconds:
              accounts[id]?.status === 'ok' ? fortniteSeconds(accounts[id].entries) : null,
          }))
          .sort((a, b) => (b.seconds ?? -1) - (a.seconds ?? -1))
  const side = others.length > 0 || linked.length > 0

  return (
    <Panel>
      <PanelHeader
        actions={
          <RefreshButton
            loading={isChecking}
            onClick={refresh}
          />
        }
        compact
        title="Time played"
      />

      <PanelBody
        className={cn(
          'grid gap-x-10 gap-y-6',
          shelf.length > 0 && side && 'xl:grid-cols-[auto_minmax(0,1fr)]'
        )}
      >
        {entry && <TimeSummary entry={entry} />}
        {shelf.length > 0 ? (
          <ul className="flex flex-wrap content-start gap-4">
            {shelf.map((item) => (
              <li
                className="w-32"
                key={item.artifactId}
              >
                <Cover entry={item} />
              </li>
            ))}
          </ul>
        ) : (
          <ShelfState
            entry={entry}
            isChecking={isChecking}
          />
        )}

        {side && (
          <div className="min-w-0 space-y-5">
            {others.length > 0 && (
              <OtherGames
                rows={others}
                visibility={describeVisibility(entry?.profileVisibility ?? null)}
                onOpen={(row) => setOpened({ accountId, row })}
              />
            )}
            {linked.length > 0 && (
              <LinkedAccounts
                rows={linked}
                selectedId={accountId}
              />
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground xl:col-span-full">
          Time started from Fortnite itself counts toward Fortnite, not the mode.
          {ok && entry.achievements === null && ' Achievements could not be loaded.'}
        </p>
      </PanelBody>

      {opened?.accountId === accountId && opened.row.achievements && (
        <AchievementsDialog
          accountId={accountId}
          game={{
            sandboxId: opened.row.achievements.sandboxId,
            title: opened.row.title ?? opened.row.achievements.title,
            art: opened.row.achievements.art,
          }}
          onClose={() => setOpened(null)}
        />
      )}
    </Panel>
  )
}

/** Why there is no shelf: still reading, could not read, or nothing played. */
function ShelfState({
  entry,
  isChecking,
}: {
  entry: AccountPlaytime | undefined
  isChecking: boolean
}) {
  if (!entry) {
    return (
      <p
        className="text-ui text-muted-foreground"
        role="status"
      >
        {isChecking ? 'Reading playtime from Epic…' : 'Playtime has not been read yet.'}
      </p>
    )
  }

  if (entry.status === 'unknown') {
    return (
      <Callout
        title="Playtime unavailable"
        tone="warning"
      >
        {entry.errorMessage ?? 'Could not read playtime. Try Refresh.'}
      </Callout>
    )
  }

  return (
    <EmptyState
      className="border-0 bg-transparent py-6"
      description={
        entry.entries.length === 0
          ? 'Epic has no time recorded for this account in any launcher app.'
          : 'Epic has time recorded for this account in other games only.'
      }
      icon={Clock}
      title="No Fortnite time recorded"
    />
  )
}

/** A mode's box art with its hours underneath, like a library shelf. */
function Cover({ entry }: { entry: PlaytimeEntry }) {
  const title = entry.title ?? 'Unnamed app'
  const src = sizedArt(entry.art.tall, 256, 342)

  return (
    <figure>
      <div className="aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        {src ? (
          <img
            alt=""
            className="size-full object-cover"
            decoding="async"
            loading="lazy"
            src={src}
          />
        ) : (
          <span className="grid size-full place-items-center px-3 text-center text-ui font-semibold text-muted-foreground">
            {title}
          </span>
        )}
      </div>
      <figcaption className="mt-2">
        <span className="block truncate text-xs text-muted-foreground">{title}</span>
        <span
          className={cn(
            'figure block font-bold leading-tight',
            entry.kind === 'fortnite' ? 'text-display-sm' : 'text-title'
          )}
        >
          {formatPlaytime(entry.seconds)}
        </span>
      </figcaption>
    </figure>
  )
}

function OtherGames({
  onOpen,
  rows,
  visibility,
}: {
  onOpen: (row: OtherGameRow) => void
  rows: Array<OtherGameRow>
  /** Who can see the Epic profile these achievements show on. */
  visibility: string | null
}) {
  return (
    <div>
      <PanelSectionHeader
        actions={
          visibility && (
            <span className="text-xs text-muted-foreground">
              Epic profile visible to {visibility}
            </span>
          )
        }
        className="px-0"
        title="Other Epic games"
      />
      <ul className="divide-y divide-border/30">
        {rows.map((row) => (
          <ListRow
            caption={gameCaption(row)}
            figure={row.seconds === null ? '—' : formatPlaytime(row.seconds)}
            key={row.key}
            name={row.title ?? 'Unnamed app'}
            onClick={row.achievements ? () => onOpen(row) : undefined}
            well={<Thumb art={row.art} />}
          />
        ))}
      </ul>
    </div>
  )
}

/** "17 of 45 achievements", the app id of an unnamed app, or no time recorded. */
function gameCaption(row: OtherGameRow) {
  return (
    [
      row.achievements ? achievementCaption(row.achievements) : null,
      row.title ? null : row.artifactId,
      row.seconds === null ? 'No time recorded' : null,
    ]
      .filter(Boolean)
      .join(' · ') || undefined
  )
}

function Thumb({ art }: { art: LibraryArt }) {
  const src = sizedArt(art.tall, 60, 80)

  return src ? (
    <img
      alt=""
      className="aspect-[3/4] h-10 shrink-0 rounded object-cover"
      decoding="async"
      loading="lazy"
      src={src}
    />
  ) : (
    <span className="aspect-[3/4] h-10 shrink-0 rounded bg-muted" />
  )
}

/** Each linked account's Fortnite hours, most played first. */
function LinkedAccounts({
  rows,
  selectedId,
}: {
  rows: Array<AccountRow>
  selectedId: string
}) {
  const total = rows.reduce((sum, row) => sum + (row.seconds ?? 0), 0)
  const unread = rows.filter((row) => row.seconds === null).length

  return (
    <div>
      <PanelSectionHeader
        actions={
          <span className="text-xs text-muted-foreground">
            <span className="figure font-semibold text-foreground/90">
              {formatPlaytime(total)}
            </span>{' '}
            on PC across {rows.length} accounts
            {unread > 0 && ` (${unread} not read)`}
          </span>
        }
        className="px-0"
        title="Linked accounts"
      />
      <ul className="divide-y divide-border/30">
        {rows.map((row) => (
          <ListRow
            caption={accountCaption(row.entry)}
            figure={row.seconds === null ? '—' : formatPlaytime(row.seconds)}
            key={row.id}
            name={
              <>
                {row.name}
                {row.id === selectedId && (
                  <span className="font-normal text-muted-foreground"> · selected</span>
                )}
              </>
            }
            well={
              <AccountAvatar
                accountId={row.id}
                lazy
                name={row.name}
                size="sm"
              />
            }
          />
        ))}
      </ul>
    </div>
  )
}

/** The modes under an account's Fortnite figure, or why there is no figure. */
function accountCaption(entry: AccountPlaytime | undefined) {
  if (!entry) {
    return 'Not read yet'
  }

  const everywhere = entry.allPlatforms
    ? `Every platform ${formatPlaytime(entry.allPlatforms.minutes * 60)}`
    : null

  if (entry.status === 'unknown') {
    return everywhere ?? entry.errorMessage ?? 'Unavailable'
  }

  const parts = [
    everywhere,
    ...entry.entries
      .filter((item) => item.kind === 'mode' && item.title)
      .map((item) => `${item.title} ${formatPlaytime(item.seconds)}`),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : undefined
}

/**
 * The two figures that answer "how long have I played": the launcher's,
 * which only sees PC, and Fortnite's own, which sees every platform but not
 * Save the World.
 */
function TimeSummary({ entry }: { entry: AccountPlaytime }) {
  const { allPlatforms } = entry

  return (
    <StatRow className="xl:col-span-full">
      <StatTile
        hint="Epic Games Launcher, every mode"
        label="On PC"
        value={entry.status === 'ok' ? formatPlaytime(fortniteSeconds(entry.entries)) : '—'}
      />
      <StatTile
        hint={
          allPlatforms
            ? ['BR and islands', ...allPlatforms.byInput.map((input) => `${input.label} ${formatPlaytime(input.minutes * 60)}`)].join(' · ')
            : 'Fortnite stats unavailable'
        }
        label="Every platform"
        value={allPlatforms ? formatPlaytime(allPlatforms.minutes * 60) : '—'}
      />
    </StatRow>
  )
}
