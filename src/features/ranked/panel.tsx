import type { AccountRanked, RankedTrack } from './model'

import { Trophy } from 'lucide-react'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import {
  Callout,
  Chip,
  EmptyState,
  ListRow,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSectionHeader,
  RefreshButton,
} from '../../components/page'

import { useGetAccounts } from '../../hooks/accounts'
import { useAccountRanked } from '../../state/accounts/ranked'

import { collapseTracks, formatPromotion, isPlacedTrack, peakTrack } from './model'

import { parseCustomDisplayName } from '../../lib/utils'

/**
 * Competitive rank, for the account hub.
 *
 * Each active ranked track is a tile — its tier named large with the tier's
 * colour beside it, the bar toward the next division under it (Unreal shows
 * its ladder position instead), the season's best as a caption. With more than
 * one account linked, every account's best current rank sits beneath, to
 * compare at a glance. Read-only, and only ever this account's own progress.
 */

type AccountRow = {
  id: string
  name: string
  entry: AccountRanked | undefined
  /** This account's best current rank, or null when unplaced/unread. */
  peak: RankedTrack | null
}

export function AccountRankedPanel({ accountId }: { accountId: string }) {
  const { accounts, isChecking, refresh } = useAccountRanked()
  const { accountList, idsList } = useGetAccounts()
  const entry = accounts[accountId]
  const ok = entry?.status === 'ok'
  const collapsed = ok ? collapseTracks(entry.tracks) : []
  const ranked = collapsed.filter(isPlacedTrack)
  const unrankedCount = collapsed.length - ranked.length
  const season = entry?.season ?? null
  const linked: Array<AccountRow> =
    idsList.length < 2
      ? []
      : idsList
          .filter((id) => accountList[id])
          .map((id) => ({
            id,
            name: parseCustomDisplayName(accountList[id]),
            entry: accounts[id],
            peak: accounts[id]?.status === 'ok' ? peakTrack(accounts[id].tracks) : null,
          }))
          .sort((a, b) => (b.peak?.tier?.index ?? -1) - (a.peak?.tier?.index ?? -1))

  return (
    <Panel>
      <PanelHeader
        actions={
          <>
            {season !== null && <Chip tone="accent">Season {season}</Chip>}
            <RefreshButton
              loading={isChecking}
              onClick={refresh}
            />
          </>
        }
        compact
        title="Ranked"
      />

      <PanelBody className="space-y-6">
        {ranked.length > 0 ? (
          <ul className="divide-y divide-border/30">
            {ranked.map((track) => (
              <TrackRow
                key={track.trackguid}
                track={track}
              />
            ))}
          </ul>
        ) : (
          <TracksState
            entry={entry}
            isChecking={isChecking}
          />
        )}

        {linked.length > 0 && (
          <LinkedAccounts
            rows={linked}
            selectedId={accountId}
          />
        )}

        {ranked.length > 0 && unrankedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {unrankedCount} other {unrankedCount === 1 ? 'mode is' : 'modes are'} not yet
            ranked this season.
          </p>
        )}
      </PanelBody>
    </Panel>
  )
}

/** One track as a compact row: the tier in its colour, with progress or ladder. */
function TrackRow({ track }: { track: RankedTrack }) {
  const { tier } = track
  const caption =
    track.showProgress && tier
      ? `${formatPromotion(track.promotionProgress)} to next rank`
      : track.ranking !== null
        ? `Ladder #${track.ranking.toLocaleString()}`
        : track.highestTier
          ? `Highest ${track.highestTier.name}`
          : undefined

  return (
    <ListRow
      caption={caption}
      figure={
        <span
          className="font-semibold"
          style={tier ? { color: tier.color } : undefined}
        >
          {tier?.name ?? 'Unranked'}
        </span>
      }
      name={track.label}
      well={
        <span
          aria-hidden
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: tier?.color ?? 'hsl(var(--muted-foreground))' }}
        />
      }
    />
  )
}

/** Why there are no ranked tiles: still reading, could not read, or none yet. */
function TracksState({
  entry,
  isChecking,
}: {
  entry: AccountRanked | undefined
  isChecking: boolean
}) {
  if (!entry) {
    return (
      <p
        className="text-ui text-muted-foreground"
        role="status"
      >
        {isChecking ? 'Reading ranked progress from Epic…' : 'Ranked progress has not been read yet.'}
      </p>
    )
  }

  if (entry.status === 'unknown') {
    return (
      <Callout
        title="Ranked unavailable"
        tone="warning"
      >
        {entry.errorMessage ?? 'Could not read ranked progress. Try Refresh.'}
      </Callout>
    )
  }

  return (
    <EmptyState
      className="border-0 bg-transparent py-6"
      description="This account has not placed on any ranked track this season."
      icon={Trophy}
      title="No ranked progress"
    />
  )
}

/** Each linked account's best current rank, highest first. */
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
        title="Linked accounts"
      />
      <ul className="divide-y divide-border/30">
        {rows.map((row) => (
          <ListRow
            caption={accountCaption(row)}
            figure={row.peak?.tier?.name ?? '—'}
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

/** The track behind an account's figure, or why there is no figure. */
function accountCaption(row: AccountRow) {
  if (!row.entry) {
    return 'Not read yet'
  }

  if (row.entry.status === 'unknown') {
    return 'Unavailable'
  }

  return row.peak ? `Best on ${row.peak.label}` : 'No ranked progress'
}
