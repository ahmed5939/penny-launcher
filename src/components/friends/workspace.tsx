import type { FriendEntry } from '../../kernel/core/friends-manager'
import type { FriendAction } from './row'

import { UpdateIcon } from '@radix-ui/react-icons'
import { Search, UserPlus } from 'lucide-react'

import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'

import { Callout, EmptyState, Panel } from '../page'

import { FriendRow, SearchResultRow } from './row'
import type { GroupedFriends } from './group'

import { cn } from '../../lib/utils'

export type FriendsWorkspaceData = {
  errorMessage: string | null
  filter: string
  grouped: GroupedFriends
  isSearching: boolean
  limitsReached: {
    accepted?: boolean
    incoming?: boolean
    outgoing?: boolean
  } | undefined
  pending: Array<string>
  query: string
  searchResults: Array<{
    accountId: string
    displayName: string
    matchType: string
    mutual: number
    platform: string
  }>
  handleAction: (accountId: string, action: FriendAction) => () => void
  handleAdd: (accountId: string) => void
  handleBulk: (accountIds: Array<string>, action: 'add' | 'remove') => void
  handleInvite: (accountId: string) => void
  setFilter: (value: string) => void
  setQuery: (value: string) => void
}

/**
 * Search, add, and the four friends lists.
 *
 * Shared by the docked panel and the hub page so a row action cannot exist
 * in one place and go missing in the other. `scrollLists` is the panel's
 * inner scroller; the page lets the window pane scroll instead.
 */
export function FriendsWorkspace({
  data,
  scrollLists = false,
  showInvite = true,
}: {
  data: FriendsWorkspaceData
  scrollLists?: boolean
  showInvite?: boolean
}) {
  const {
    errorMessage,
    filter,
    grouped,
    handleAction,
    handleAdd,
    handleBulk,
    handleInvite,
    isSearching,
    limitsReached,
    pending,
    query,
    searchResults,
    setFilter,
    setQuery,
  } = data

  return (
    <>
      <div
        className={cn(
          'space-y-2',
          scrollLists && 'border-b border-border/60 px-4 py-3'
        )}
      >
        {limitsReached && Object.values(limitsReached).some(Boolean) && (
          <Callout tone="warning">
            An Epic friends limit has been reached. Remove old requests or
            friends before adding more.
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
                <SearchResultRow
                  isPending={pending.includes(result.accountId)}
                  key={result.accountId}
                  onAdd={handleAdd}
                  result={result}
                />
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <Tabs
        defaultValue="friends"
        className={cn(
          'flex flex-col',
          scrollLists ? 'min-h-0 flex-1' : 'gap-1'
        )}
      >
        <TabsList
          className={cn(
            'grid grid-cols-4',
            scrollLists ? 'mx-3 mt-3' : 'w-full'
          )}
        >
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
            className={scrollLists ? 'mx-3 mt-2' : undefined}
            tone="danger"
          >
            {errorMessage}
          </Callout>
        )}

        <FriendTab
          scroll={scrollLists}
          value="friends"
        >
          <Section
            empty="No friends yet."
            entries={grouped.friends}
            pending={pending}
            onAction={handleAction}
            onInvite={handleInvite}
            showInvite={showInvite}
          />
        </FriendTab>
        <FriendTab
          scroll={scrollLists}
          value="incoming"
        >
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
        <FriendTab
          scroll={scrollLists}
          value="outgoing"
        >
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
        <FriendTab
          scroll={scrollLists}
          value="blocked"
        >
          <Section
            empty="No blocked accounts."
            entries={grouped.blocked}
            pending={pending}
            onAction={handleAction}
          />
        </FriendTab>
      </Tabs>
    </>
  )
}

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
  onInvite,
  pending,
  showInvite,
}: {
  bulkActions?: Array<{
    action: () => void
    destructive?: boolean
    label: string
  }>
  empty: string
  entries: Array<FriendEntry>
  onAction: (accountId: string, action: FriendAction) => () => void
  onInvite?: (accountId: string) => void
  pending: Array<string>
  showInvite?: boolean
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
          <FriendRow
            entry={entry}
            key={`${entry.kind}-${entry.accountId}`}
            isPending={pending.includes(entry.accountId)}
            onAction={onAction}
            onInvite={onInvite}
            showInvite={showInvite}
          />
        ))}
      </ul>
    </section>
  )
}

function FriendTab({
  children,
  scroll,
  value,
}: {
  children: React.ReactNode
  scroll: boolean
  value: string
}) {
  return (
    <TabsContent
      className={cn('mt-2', scroll && 'min-h-0 flex-1')}
      value={value}
    >
      {scroll ? (
        <ScrollArea
          className="h-full w-full"
          viewportClassName="[&>div]:!block [&>div]:!w-full"
        >
          {children}
        </ScrollArea>
      ) : (
        children
      )}
    </TabsContent>
  )
}
