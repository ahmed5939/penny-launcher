import type { FriendEntry } from '../../kernel/core/friends-manager'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  Ban,
  Check,
  Contact,
  ExternalLink,
  RotateCw,
  Search,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'

import { BetaBadge } from '../navigation/beta-badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'

import { PlatformIcon } from './platform-icon'
import { useFriendsPanel } from './hooks'

import { pennyDBProfileUrl } from '../../services/endpoints/pennydb'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * Friends live in a docked panel rather than a page or a modal sheet.
 *
 * Friends are something you consult *while* doing something else — inviting
 * to a party, checking who is on — so both a separate screen and a modal
 * overlay broke the task you opened it for. This sits alongside the content
 * and the app stays fully usable next to it.
 */
export function FriendsPanel() {
  const {
    closePanel,
    errorMessage,
    filter,
    grouped,
    handleAction,
    handleAdd,
    handleReload,
    isLoading,
    isOpen,
    isSearching,
    pending,
    query,
    searchResults,
    selected,
    setFilter,
    setQuery,
  } = useFriendsPanel()

  if (!isOpen) {
    return null
  }

  return (
    <aside className="flex w-[25rem] shrink-0 flex-col border-l border-border/60 bg-surface/50">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Contact className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          Friends
          {selected && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              · {parseCustomDisplayName(selected)}
            </span>
          )}
        </span>
        <BetaBadge />
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          title="Reload"
          disabled={isLoading || !selected}
          onClick={handleReload}
        >
          <RotateCw className={cn('size-4', isLoading && 'animate-spin')} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          title="Close"
          onClick={closePanel}
        >
          <X className="size-4" />
        </Button>
      </header>

      {!selected ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Select an account to see its friends.
        </p>
      ) : (
        <>
          <div className="space-y-2 border-b border-border/60 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder="Filter your friends"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
            <div className="relative">
              <UserPlus className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder="Search Epic to add someone"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {isSearching && (
                <UpdateIcon className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {searchResults.length > 0 && (
              <ul className="overflow-hidden rounded-lg border border-border/70">
                {searchResults.map((result) => (
                  <li
                    className="flex items-center gap-2 border-b border-border/40 px-2.5 py-2 last:border-0"
                    key={result.accountId}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {result.displayName}
                      </span>
                      <span className="block text-[0.65rem] text-muted-foreground">
                        {result.platform}
                        {result.matchType === 'exact' && ' · exact'}
                        {result.mutual > 0 && ` · ${result.mutual} mutual`}
                      </span>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0"
                      title="Send friend request"
                      disabled={pending.includes(result.accountId)}
                      onClick={() => handleAdd(result.accountId)}
                    >
                      <UserPlus className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/*
            Radix wraps viewport content in a `display: table` div, which
            sizes to its widest child instead of to the panel — that is what
            pushed the row buttons past the right edge. Force it to a normal
            full-width block.
          */}
          <ScrollArea
            className="min-h-0 w-full flex-1"
            viewportClassName="[&>div]:!block [&>div]:!w-full"
          >
            {errorMessage && (
              <p className="px-4 py-3 text-xs text-destructive">
                {errorMessage}
              </p>
            )}

            <Section
              title={`Friends (${grouped.friends.length})`}
              entries={grouped.friends}
              pending={pending}
              onAction={handleAction}
            />
            <Section
              title={`Incoming (${grouped.incoming.length})`}
              entries={grouped.incoming}
              pending={pending}
              onAction={handleAction}
            />
            <Section
              title={`Sent (${grouped.outgoing.length})`}
              entries={grouped.outgoing}
              pending={pending}
              onAction={handleAction}
            />
            <Section
              title={`Blocked (${grouped.blocked.length})`}
              entries={grouped.blocked}
              pending={pending}
              onAction={handleAction}
            />

            {!isLoading &&
              !errorMessage &&
              grouped.friends.length === 0 &&
              grouped.incoming.length === 0 &&
              grouped.outgoing.length === 0 &&
              grouped.blocked.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  {filter ? 'Nothing matches that.' : 'No friends yet.'}
                </p>
              )}
          </ScrollArea>

          {selected && (
            <footer className="border-t border-border/60 p-3">
              <Button
                className="w-full"
                size="sm"
                variant="secondary"
                onClick={() =>
                  window.electronAPI.openExternalURL(
                    pennyDBProfileUrl(selected.displayName)
                  )
                }
              >
                <ExternalLink className="size-3.5" />
                Open this account on PennyDB
              </Button>
            </footer>
          )}
        </>
      )}
    </aside>
  )
}

function Section({
  entries,
  onAction,
  pending,
  title,
}: {
  entries: Array<FriendEntry>
  onAction: (
    accountId: string,
    action: 'add' | 'block' | 'remove' | 'unblock'
  ) => () => void
  pending: Array<string>
  title: string
}) {
  if (entries.length === 0) {
    return null
  }

  return (
    <section>
      <h3 className="sticky top-0 z-10 bg-surface/95 px-4 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
        {title}
      </h3>
      <ul className="divide-y divide-border/40">
        {entries.map((entry) => (
          <Row
            entry={entry}
            key={`${entry.kind}-${entry.accountId}`}
            isPending={pending.includes(entry.accountId)}
            onAction={onAction}
          />
        ))}
      </ul>
    </section>
  )
}

function Row({
  entry,
  isPending,
  onAction,
}: {
  entry: FriendEntry
  isPending: boolean
  onAction: (
    accountId: string,
    action: 'add' | 'block' | 'remove' | 'unblock'
  ) => () => void
}) {
  const isBlocked = entry.kind === 'blocked'
  /** PennyDB indexes by Epic display name, so a fallback name won't resolve. */
  const canOpenPennyDB = entry.nameSource === 'epic'

  return (
    <li className="group flex w-full items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-xs font-medium',
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
                  className="size-[0.9rem] text-muted-foreground"
                  platform={link.platform}
                />
                <span className="truncate text-[0.7rem] text-muted-foreground">
                  {link.displayName}
                </span>
              </span>
            ))}
          </span>
        ) : (
          (entry.mutual > 0 || entry.nameSource === 'id') && (
            <span className="mt-0.5 block truncate text-[0.7rem] text-muted-foreground">
              {entry.mutual > 0
                ? `${entry.mutual} mutual`
                : 'No linked accounts'}
            </span>
          )
        )}
      </span>

      {isPending ? (
        <UpdateIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <span className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
          {canOpenPennyDB && (
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              title="Open on PennyDB"
              onClick={() =>
                window.electronAPI.openExternalURL(
                  pennyDBProfileUrl(entry.displayName)
                )
              }
            >
              <ExternalLink className="size-3.5" />
            </Button>
          )}

          {entry.kind === 'incoming' && (
            <Button
              size="icon"
              variant="ghost"
              className="size-6 text-success"
              title="Accept"
              onClick={onAction(entry.accountId, 'add')}
            >
              <Check className="size-3.5" />
            </Button>
          )}

          {isBlocked ? (
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              title="Unblock"
              onClick={onAction(entry.accountId, 'unblock')}
            >
              <Ban className="size-3.5" />
            </Button>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                title="Remove friend"
                onClick={onAction(entry.accountId, 'remove')}
              >
                <UserMinus className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-6 text-destructive"
                title="Block"
                onClick={onAction(entry.accountId, 'block')}
              >
                <Ban className="size-3.5" />
              </Button>
            </>
          )}
        </span>
      )}
    </li>
  )
}
