import type { AccountStanding, StandingItem } from './model'

import { ShieldAlert, ShieldCheck, ShieldEllipsis, ShieldQuestion, ShieldX } from 'lucide-react'

import { Callout } from '../../components/page'

import { useGetAccounts } from '../../hooks/accounts'
import { useAccountStanding } from '../../state/accounts/standing'

import {
  formatBanDuration,
  humaniseStandingText,
  isStandingItemActive,
} from './model'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * Social standing, said quietly when it is fine and plainly when it is not.
 *
 * The line sits under an account's name; the callout only appears when the
 * account has a live ban or warning, and lists them. Both read the one
 * standing check that covers every linked account.
 */

const dateFormat: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, dateFormat) : null
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** Bans still in force; warnings all count — they carry no dates to lapse by. */
function activeItems(entry: AccountStanding) {
  const now = Date.now()

  return {
    bans: entry.bans.filter((item) => isStandingItemActive(item, now)),
    warnings: entry.warnings,
  }
}

/** "Good standing", "1 social warning", "Social ban in effect" — plus the other accounts in brief. */
export function AccountStandingLine({ accountId }: { accountId: string }) {
  const { accounts, isChecking, refresh } = useAccountStanding()
  const { accountList, idsList } = useGetAccounts()
  const entry = accounts[accountId]

  if (!entry) {
    return isChecking ? (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <ShieldEllipsis className="size-3.5 shrink-0" />
        Checking social standing…
      </div>
    ) : null
  }

  const others = idsList.filter((id) => id !== accountId)
  const flagged = others.filter(
    (id) => accounts[id]?.status === 'banned' || accounts[id]?.status === 'warned'
  )
  const othersAllGood =
    others.length > 0 && others.every((id) => accounts[id]?.status === 'good')
  const { bans, warnings } = activeItems(entry)

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      {entry.status === 'good' && (
        <>
          <ShieldCheck className="size-3.5 shrink-0 text-success" />
          <span className="text-foreground/80">Good standing</span>
          {othersAllGood && <span>· so is every other linked account</span>}
        </>
      )}
      {entry.status === 'warned' && (
        <>
          <ShieldAlert className="size-3.5 shrink-0 text-warning" />
          <span className="font-medium text-warning">
            {plural(warnings.length, 'social warning')}
          </span>
        </>
      )}
      {entry.status === 'banned' && (
        <>
          <ShieldX className="size-3.5 shrink-0 text-destructive" />
          <span className="font-medium text-destructive">
            {bans.length > 1 ? `${bans.length} social bans in effect` : 'Social ban in effect'}
          </span>
        </>
      )}
      {entry.status === 'unknown' && (
        <>
          <ShieldQuestion className="size-3.5 shrink-0" />
          <span title={entry.errorMessage}>Standing unavailable</span>
          <span>·</span>
          <button
            className="font-medium text-primary hover:underline disabled:opacity-50"
            disabled={isChecking}
            type="button"
            onClick={refresh}
          >
            Check again
          </button>
        </>
      )}
      {flagged.map((id) => (
        <span key={id}>
          ·{' '}
          <span className="text-foreground/80">
            {parseCustomDisplayName(accountList[id])}
          </span>
          :{' '}
          <span
            className={cn(
              accounts[id]?.status === 'banned' ? 'text-destructive' : 'text-warning'
            )}
          >
            {accounts[id]?.status === 'banned' ? 'social ban' : 'warning'}
          </span>
        </span>
      ))}
    </div>
  )
}

/** The account's live bans and warnings, or nothing when there are none. */
export function AccountStandingCallout({ accountId }: { accountId: string }) {
  const { accounts } = useAccountStanding()
  const entry = accounts[accountId]

  if (!entry || (entry.status !== 'banned' && entry.status !== 'warned')) {
    return null
  }

  const { bans, warnings } = activeItems(entry)
  const banned = entry.status === 'banned'

  return (
    <Callout
      title={banned ? 'Social ban in effect' : 'Social warning on this account'}
      tone={banned ? 'danger' : 'warning'}
    >
      <p>
        Epic's social ban service lists{' '}
        {[
          bans.length > 0 && plural(bans.length, 'active ban'),
          warnings.length > 0 && plural(warnings.length, 'warning'),
        ]
          .filter(Boolean)
          .join(' and ')}{' '}
        for this account.
      </p>
      <ul className="mt-2 space-y-2">
        {bans.map((item, index) => (
          <StandingRow item={item} key={`ban-${item.id ?? index}`} kind="Ban" />
        ))}
        {warnings.map((item, index) => (
          <StandingRow item={item} key={`warning-${item.id ?? index}`} kind="Warning" />
        ))}
      </ul>
    </Callout>
  )
}

/**
 * One ban or warning. A ban has dates and a length; a warning has none, and
 * none are made up for it. Both say whether the player has seen them in-game
 * (`acked`).
 */
function StandingRow({ item, kind }: { item: StandingItem; kind: 'Ban' | 'Warning' }) {
  const reason = humaniseStandingText(item.reason)
  const type = humaniseStandingText(item.type)
  const length = kind === 'Ban' ? formatBanDuration(item.durationSeconds) : null
  const started = kind === 'Ban' ? formatDate(item.startsAt) : null
  const ends = kind === 'Ban' ? formatDate(item.expiresAt) : null
  const details = [
    length,
    started ? `started ${started}` : null,
    kind === 'Ban' ? (ends ? `ends ${ends}` : 'no end date given') : null,
    item.acknowledged === true
      ? 'acknowledged'
      : item.acknowledged === false
        ? 'not yet seen in-game'
        : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li>
      <span className="font-medium text-foreground">
        {kind}
        {reason && `: ${reason}`}
      </span>
      {type && type !== reason && <span> · {type}</span>}
      {details && (
        <span className="block text-xs">
          {details.charAt(0).toUpperCase() + details.slice(1)}
        </span>
      )}
    </li>
  )
}
