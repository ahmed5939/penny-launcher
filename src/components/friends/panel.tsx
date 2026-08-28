import type { FriendEntry } from '../../kernel/core/friends-manager'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  Ban,
  Check,
  Contact,
  ExternalLink,
  RotateCw,
  Search,
  Star,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'

import { Callout, EmptyState, Panel, PanelHeader } from '../page'

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
    handleBulk,
    handleReload,
    isLoading,
    isOpen,
    isSearching,
    limitsReached,
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
    <aside className="chrome-surface flex w-[25rem] shrink-0 flex-col border-l border-border/60">
      <PanelHeader
        className="shrink-0"
        compact
        icon={Contact}
        title={
          <>
            Friends
            {selected && (
              <span className="font-normal text-muted-foreground">
                {' · '}
                {parseCustomDisplayName(selected)}
              </span>
            )}
          </>
        }
        actions={
          <>
            <Button
              className="size-7"
              disabled={isLoading || !selected}
              size="icon"
              title="Reload"
              variant="ghost"
              onClick={handleReload}
            >
              <RotateCw
                className={cn('size-4', isLoading && 'animate-spin')}
              />
            </Button>
            <Button
              className="size-7"
              size="icon"
              title="Close"
              variant="ghost"
              onClick={closePanel}
            >
              <X className="size-4" />
            </Button>
          </>
        }
      />

      {!selected ? (
        <EmptyState
          className="m-3"
          icon={Contact}
          title="Select an account to see its friends."
        />
      ) : (
        <>
          <div className="space-y-2 border-b border-border/60 px-4 py-3">
            {limitsReached && Object.values(limitsReached).some(Boolean) && (
              <Callout tone="warning">
                An Epic friends limit has been reached. Remove old requests
                or friends before adding more.
              </Callout>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Filter your friends"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>
            <div className="relative">
              <UserPlus className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search Epic to add someone"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {isSearching && (
                <UpdateIcon className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {searchResults.length > 0 && (
              <Panel>
                <ul className="divide-y divide-border/40">
                  {searchResults.map((result) => (
                    <li
                      className="flex items-center gap-2 px-2.5 py-2"
                      key={result.accountId}
                    >
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
                        disabled={pending.includes(result.accountId)}
                        size="icon"
                        title="Send friend request"
                        variant="ghost"
                        onClick={() => handleAdd(result.accountId)}
                      >
                        <UserPlus className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          {/*
            Radix wraps viewport content in a `display: table` div, which
            sizes to its widest child instead of to the panel — that is what
            pushed the row buttons past the right edge. Force it to a normal
            full-width block.
          */}
          <Tabs
            defaultValue="friends"
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="mx-3 mt-3 grid grid-cols-4">
              <CountTab
                count={grouped.friends.length}
                label="Friends"
                value="friends"
              />
              <CountTab
                count={grouped.incoming.length}
                label="Incoming"
                value="incoming"
              />
              <CountTab
                count={grouped.outgoing.length}
                label="Sent"
                value="outgoing"
              />
              <CountTab
                count={grouped.blocked.length}
                label="Blocked"
                value="blocked"
              />
            </TabsList>
            {errorMessage && (
              <Callout
                className="mx-3 mt-2"
                tone="danger"
              >
                {errorMessage}
              </Callout>
            )}

            <FriendTab value="friends">
              <Section
                empty="No friends yet."
                entries={grouped.friends}
                pending={pending}
                onAction={handleAction}
              />
            </FriendTab>
            <FriendTab value="incoming">
              <Section
                empty="No incoming requests."
                entries={grouped.incoming}
                pending={pending}
                onAction={handleAction}
                bulkActions={[
                  {
                    label: 'Accept all',
                    action: () =>
                      handleBulk(
                        grouped.incoming.map((entry) => entry.accountId),
                        'add'
                      ),
                  },
                  {
                    label: 'Reject all',
                    destructive: true,
                    action: () =>
                      handleBulk(
                        grouped.incoming.map((entry) => entry.accountId),
                        'remove'
                      ),
                  },
                ]}
              />
            </FriendTab>
            <FriendTab value="outgoing">
              <Section
                empty="No sent requests."
                entries={grouped.outgoing}
                pending={pending}
                onAction={handleAction}
                bulkActions={[
                  {
                    label: 'Cancel all',
                    destructive: true,
                    action: () =>
                      handleBulk(
                        grouped.outgoing.map((entry) => entry.accountId),
                        'remove'
                      ),
                  },
                ]}
              />
            </FriendTab>
            <FriendTab value="blocked">
              <Section
                empty="No blocked accounts."
                entries={grouped.blocked}
                pending={pending}
                onAction={handleAction}
              />
            </FriendTab>
          </Tabs>

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

/** A tab whose label carries how many rows are behind it. */
function CountTab({
  count,
  label,
  value,
}: {
  count: number
  label: string
  value: string
}) {
  return (
    <TabsTrigger
      className="gap-1 px-1 text-xs"
      value={value}
    >
      {label}
      <span className="figure text-muted-foreground">{count}</span>
    </TabsTrigger>
  )
}

function Section({
  bulkActions,
  empty,
  entries,
  onAction,
  pending,
}: {
  bulkActions?: Array<{
    action: () => void
    destructive?: boolean
    label: string
  }>
  empty: string
  entries: Array<FriendEntry>
  onAction: (
    accountId: string,
    action: 'add' | 'block' | 'remove' | 'unblock'
  ) => () => void
  pending: Array<string>
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        className="m-3"
        title={empty}
      />
    )
  }

  return (
    <section>
      {bulkActions && (
        <div className="flex justify-end gap-2 border-b border-border/60 px-3 py-2">
          {bulkActions.map((bulk) => (
            <Button
              disabled={pending.length > 0}
              key={bulk.label}
              size="sm"
              variant={bulk.destructive ? 'destructive' : 'secondary'}
              onClick={bulk.action}
            >
              {bulk.label}
            </Button>
          ))}
        </div>
      )}
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

function FriendTab({
  children,
  value,
}: {
  children: React.ReactNode
  value: string
}) {
  return (
    <TabsContent
      className="mt-2 min-h-0 flex-1"
      value={value}
    >
      <ScrollArea
        className="h-full w-full"
        viewportClassName="[&>div]:!block [&>div]:!w-full"
      >
        {children}
      </ScrollArea>
    </TabsContent>
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
  const hasSafeActions =
    canOpenPennyDB || entry.kind === 'incoming' || isBlocked
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
function RowAction({
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
