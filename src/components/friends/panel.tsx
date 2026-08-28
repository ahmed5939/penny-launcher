import { Contact, ExternalLink, Maximize2, RotateCw, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Button } from '../ui/button'

import { EmptyState, PanelHeader } from '../page'

import { FriendsWorkspace } from './workspace'
import { useFriendsPanel } from './hooks'

import { pennyDBProfileUrl } from '../../services/endpoints/pennydb'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * Friends live in a docked panel *and* a dedicated hub page.
 *
 * The panel stays for consulting a list while you work elsewhere; the hub
 * is the place to search, manage, and invite without squeezing into 25rem.
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
    handleInvite,
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
              asChild
              className="size-7"
              size="icon"
              title="Open Friends page"
              variant="ghost"
            >
              <Link to="/account-management/friends">
                <Maximize2 className="size-4" />
              </Link>
            </Button>
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
          <div className="flex min-h-0 flex-1 flex-col">
            <FriendsWorkspace
              scrollLists
              data={{
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
              }}
            />
          </div>

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
        </>
      )}
    </aside>
  )
}
