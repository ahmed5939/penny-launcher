import type { FriendEntry, FriendsActionPayload, FriendsSearchResult } from '../../kernel/core/friends-manager'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  Ban,
  Check,
  ExternalLink,
  Send,
  UserMinus,
  UserPlus,
  X,
  Star,
} from 'lucide-react'

import { Button } from '../ui/button'

import { PlatformIcon } from './platform-icon'

import { pennyDBProfileUrl } from '../../services/endpoints/pennydb'

import { cn } from '../../lib/utils'

export type FriendAction = FriendsActionPayload['action']

export function SearchResultRow({
  isPending,
  onAdd,
  result,
}: {
  isPending: boolean
  onAdd: (accountId: string) => void
  result: FriendsSearchResult
}) {
  return (
    <li className="flex items-center gap-2 px-2.5 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium">
          {result.displayName}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {result.platform}
          {result.matchType === 'exact' && ' · exact'}
          {result.mutual > 0 && ` · ${result.mutual} mutual`}
        </span>
      </span>
      <Button
        className="size-7 shrink-0 text-muted-foreground"
        disabled={isPending}
        size="icon"
        title="Send friend request"
        variant="ghost"
        onClick={() => onAdd(result.accountId)}
      >
        <UserPlus className="size-3.5" />
      </Button>
    </li>
  )
}

export function FriendRow({
  entry,
  isPending,
  onAction,
  onInvite,
  showInvite,
}: {
  entry: FriendEntry
  isPending: boolean
  onAction: (accountId: string, action: FriendAction) => () => void
  onInvite?: (accountId: string) => void
  showInvite?: boolean
}) {
  const isBlocked = entry.kind === 'blocked'
  /** PennyDB indexes by Epic display name, so a fallback name won't resolve. */
  const canOpenPennyDB = entry.nameSource === 'epic'
  const canInvite = showInvite && entry.kind === 'friend' && Boolean(onInvite)
  const hasSafeActions =
    canOpenPennyDB || canInvite || entry.kind === 'incoming' || isBlocked
  const hasDestructiveActions =
    entry.kind === 'incoming' ||
    entry.kind === 'outgoing' ||
    entry.kind === 'friend'

  return (
    <li className="group flex w-full items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {entry.favorite && (
            <Star
              className="size-3 fill-warning text-warning"
              aria-label="Favorite"
            />
          )}
          <span
            className={cn(
              'truncate text-[0.8125rem] font-medium',
              entry.nameSource !== 'epic' && 'text-muted-foreground'
            )}
          >
            {entry.displayName}
          </span>
        </span>

        {entry.linked.length > 0 ? (
          <span className="mt-0.5 flex items-center gap-2 overflow-hidden">
            {entry.linked.map((link) => (
              <span
                className="flex min-w-0 items-center gap-1"
                key={link.platform}
              >
                <PlatformIcon
                  className="size-3.5 text-muted-foreground"
                  platform={link.platform}
                />
                <span className="truncate text-xs text-muted-foreground">
                  {link.displayName}
                </span>
              </span>
            ))}
          </span>
        ) : (
          (entry.mutual > 0 || entry.nameSource === 'id') && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {entry.mutual > 0
                ? `${entry.mutual} mutual`
                : 'No linked accounts'}
            </span>
          )
        )}
        {(entry.alias || entry.note || entry.created) && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {entry.alias ||
              entry.note ||
              (entry.created
                ? `Friends since ${new Date(entry.created).toLocaleDateString()}`
                : '')}
          </span>
        )}
      </span>

      {isPending ? (
        <UpdateIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <span className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
          {canInvite && onInvite && (
            <RowAction
              title="Invite to party"
              onClick={() => onInvite(entry.accountId)}
            >
              <Send className="size-3.5" />
            </RowAction>
          )}

          {canOpenPennyDB && (
            <RowAction
              title="Open on PennyDB"
              onClick={() =>
                window.electronAPI.openExternalURL(
                  pennyDBProfileUrl(entry.displayName)
                )
              }
            >
              <ExternalLink className="size-3.5" />
            </RowAction>
          )}

          {entry.kind === 'incoming' && (
            <RowAction
              title="Accept request"
              tone="affirmative"
              onClick={onAction(entry.accountId, 'add')}
            >
              <Check className="size-3.5" />
            </RowAction>
          )}

          {isBlocked && (
            <RowAction
              title="Unblock"
              onClick={onAction(entry.accountId, 'unblock')}
            >
              <Ban className="size-3.5" />
            </RowAction>
          )}

          {hasSafeActions && hasDestructiveActions && (
            <span
              aria-hidden
              className="mx-1 h-4 w-px shrink-0 bg-border/60"
            />
          )}

          {entry.kind === 'incoming' && (
            <RowAction
              title="Reject request"
              tone="danger"
              onClick={onAction(entry.accountId, 'remove')}
            >
              <X className="size-3.5" />
            </RowAction>
          )}

          {entry.kind === 'outgoing' && (
            <RowAction
              title="Cancel request"
              tone="danger"
              onClick={onAction(entry.accountId, 'remove')}
            >
              <X className="size-3.5" />
            </RowAction>
          )}

          {entry.kind === 'friend' && (
            <>
              <RowAction
                title="Remove friend"
                tone="danger"
                onClick={onAction(entry.accountId, 'remove')}
              >
                <UserMinus className="size-3.5" />
              </RowAction>
              <RowAction
                title="Block"
                tone="danger"
                onClick={onAction(entry.accountId, 'block')}
              >
                <Ban className="size-3.5" />
              </RowAction>
            </>
          )}
        </span>
      )}
    </li>
  )
}

/**
 * One action on a friend row.
 *
 * The `danger` tone earns its separation by staying quiet: it sits after a
 * hairline and the red only arrives under the pointer, on the button you are
 * about to press. Four icons of identical weight with a permanently red one
 * among them is a row where the red has stopped meaning anything — and where
 * "block" is one pixel of aim away from "open profile".
 *
 * `affirmative` is the opposite move: an incoming request has exactly one
 * answer worth making obvious, so it is the only colour in its row.
 */
export function RowAction({
  children,
  onClick,
  title,
  tone = 'neutral',
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  tone?: 'affirmative' | 'danger' | 'neutral'
}) {
  return (
    <Button
      className={cn(
        'size-6',
        tone === 'affirmative' ? 'text-success' : 'text-muted-foreground',
        tone === 'danger' &&
          '[&:not(:disabled)]:hover:bg-destructive/10 [&:not(:disabled)]:hover:text-destructive'
      )}
      size="icon"
      title={title}
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
