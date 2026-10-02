import type { AccountTournaments, EventSummary } from './model'

import { Trophy } from 'lucide-react'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import {
  Callout,
  EmptyState,
  IconWell,
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
import { useAccountTournaments } from '../../state/accounts/tournaments'

import { formatPlacement, formatPoints } from './model'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * Competitive history, for the account hub.
 *
 * Read-only and the account's own: the events it has actually competed in —
 * history only, not the upcoming calendar — each with the account's best
 * placement and points. Many accounts have none — a Save the World account
 * never touches the competitive calendar — so the empty state is written to
 * read as a plain fact, not a
 * fault. With more than one account linked, every account's best placement
 * sits alongside, the way the playtime panel compares hours.
 */

type AccountRow = {
  id: string
  name: string
  entry: AccountTournaments | undefined
  /** Best placement across this account's events, or null when none/unread. */
  bestRank: number | null
  played: number
}

/** Best (lowest) placement an account reached across everything it played. */
function bestRankOf(entry: AccountTournaments | undefined) {
  if (entry?.status !== 'ok') {
    return null
  }

  return entry.events.reduce<number | null>(
    (best, event) =>
      event.bestRank === null
        ? best
        : best === null
          ? event.bestRank
          : Math.min(best, event.bestRank),
    null
  )
}

/** Most points an account earned in a single window. */
function bestPointsOf(entry: AccountTournaments) {
  return entry.events.reduce<number | null>(
    (best, event) =>
      event.bestPoints === null
        ? best
        : best === null
          ? event.bestPoints
          : Math.max(best, event.bestPoints),
    null
  )
}

export function AccountTournamentsPanel({ accountId }: { accountId: string }) {
  const { accounts, isChecking, refresh } = useAccountTournaments()
  const { accountList, idsList } = useGetAccounts()
  const entry = accounts[accountId]
  const ok = entry?.status === 'ok'
  // History only: events the account actually competed in, newest first.
  const events = ok ? entry.events.filter((event) => event.played) : []
  const linked: Array<AccountRow> =
    idsList.length < 2
      ? []
      : idsList
          .filter((id) => accountList[id])
          .map((id) => ({
            id,
            name: parseCustomDisplayName(accountList[id]),
            entry: accounts[id],
            bestRank: bestRankOf(accounts[id]),
            played:
              accounts[id]?.status === 'ok'
                ? accounts[id].events.filter((event) => event.played).length
                : 0,
          }))
          .sort((a, b) => (a.bestRank ?? Infinity) - (b.bestRank ?? Infinity))

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
        icon={Trophy}
        title="Tournaments"
      />

      <PanelBody
        className={cn(
          'grid gap-x-10 gap-y-6',
          events.length > 0 && linked.length > 0 && 'xl:grid-cols-[minmax(0,1fr)_auto]'
        )}
      >
        {ok && events.length > 0 && (
          <Summary
            entry={entry}
            played={events.length}
          />
        )}

        {events.length > 0 ? (
          <div className="min-w-0">
            <PanelSectionHeader
              className="px-0"
              title="Event history"
            />
            <ul className="divide-y divide-border/30">
              {events.map((event) => (
                <EventRow
                  event={event}
                  key={event.eventId}
                />
              ))}
            </ul>
          </div>
        ) : (
          <EventsState
            entry={entry}
            isChecking={isChecking}
          />
        )}

        {linked.length > 0 && (
          <div className="min-w-0 xl:w-72">
            <LinkedAccounts
              rows={linked}
              selectedId={accountId}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground xl:col-span-full">
          Placement and points are read from this account’s own results, newest
          events first.
        </p>
      </PanelBody>
    </Panel>
  )
}

/** The account's headline: events played, its best placement, its best points. */
function Summary({ entry, played }: { entry: AccountTournaments; played: number }) {
  const bestRank = bestRankOf(entry)
  const bestPoints = bestPointsOf(entry)

  return (
    <StatRow className="xl:col-span-full">
      <StatTile
        hint="With a recorded result"
        label="Events played"
        value={played.toLocaleString()}
      />
      <StatTile
        hint="Lowest placement reached"
        label="Best placement"
        tone={bestRank !== null && bestRank <= 3 ? 'primary' : 'default'}
        value={formatPlacement(bestRank)}
      />
      <StatTile
        hint="Most in a single window"
        label="Best points"
        value={formatPoints(bestPoints)}
      />
    </StatRow>
  )
}

/** One event: its name and parts, with the account's placement on the rail. */
function EventRow({ event }: { event: EventSummary }) {
  const { title } = event
  const meta = [title.season, title.mode, title.region ?? event.regions[0] ?? null]
    .filter(Boolean)
    .join(' · ')
  const result = [
    formatPoints(event.bestPoints),
    `best of ${event.matchesPlayed} ${event.matchesPlayed === 1 ? 'match' : 'matches'}`,
  ].join(' · ')

  return (
    <ListRow
      caption={[meta, result].filter(Boolean).join(' · ') || undefined}
      figure={formatPlacement(event.bestRank)}
      name={title.label}
      well={
        <IconWell
          icon={Trophy}
          size="sm"
          tone={event.bestRank !== null && event.bestRank <= 3 ? 'accent' : 'neutral'}
        />
      }
    />
  )
}

/** Why there are no events: still reading, could not read, or none to show. */
function EventsState({
  entry,
  isChecking,
}: {
  entry: AccountTournaments | undefined
  isChecking: boolean
}) {
  if (!entry) {
    return (
      <p
        className="text-ui text-muted-foreground"
        role="status"
      >
        {isChecking
          ? 'Reading competitive history from Epic…'
          : 'Competitive history has not been read yet.'}
      </p>
    )
  }

  if (entry.status === 'unknown') {
    return (
      <Callout
        title="Competitive history unavailable"
        tone="warning"
      >
        {entry.errorMessage ?? 'Could not read competitive history. Try Refresh.'}
      </Callout>
    )
  }

  return (
    <EmptyState
      className="border-0 bg-transparent py-6"
      description="This account has not entered a Fortnite competitive event. Save the World-only accounts never will."
      icon={Trophy}
      title="No competitive history"
    />
  )
}

/** Each linked account's best placement, best first — the playtime panel's rail. */
function LinkedAccounts({
  rows,
  selectedId,
}: {
  rows: Array<AccountRow>
  selectedId: string
}) {
  return (
    <div>
      <PanelSectionHeader
        className="px-0"
        title="Across your accounts"
      />
      <ul className="divide-y divide-border/30">
        {rows.map((row) => (
          <ListRow
            caption={accountCaption(row)}
            figure={row.bestRank === null ? '—' : formatPlacement(row.bestRank)}
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

/** How many events an account played, or why it has no figure. */
function accountCaption(row: AccountRow) {
  if (!row.entry) {
    return 'Not read yet'
  }

  if (row.entry.status === 'unknown') {
    return 'Unavailable'
  }

  if (row.played === 0) {
    return 'No competitive history'
  }

  return `${row.played} ${row.played === 1 ? 'event' : 'events'} played`
}
