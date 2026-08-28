import {
  Ban,
  Contact,
  RotateCw,
  UserPlus,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import {
  AccountToolbar,
  EmptyState,
  PageHeader,
  Panel,
  StatRow,
  StatTile,
} from '../../../components/page'

import { FriendsWorkspace } from '../../../components/friends/workspace'
import { useFriendsHub } from '../../../components/friends/hooks'

import { parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Contact}
        section={t('account-management.title')}
        title={t('account-management.options.friends')}
        description="Search, add, and manage Epic friends for the selected account. Invite people to your party from the list — the docked panel is still there when you need it beside another tool."
      />
      <Content />
    </>
  )
}

function Content() {
  const {
    errorMessage,
    filter,
    grouped,
    handleAction,
    handleAdd,
    handleBulk,
    handleInvite,
    handleReload,
    isLoading,
    isSearching,
    limitsReached,
    pending,
    query,
    searchResults,
    selected,
    setFilter,
    setQuery,
  } = useFriendsHub()

  if (!selected) {
    return (
      <EmptyState
        icon={Contact}
        title="Select an account to see its friends."
        description="Friends are loaded for the account in the titlebar picker."
      />
    )
  }

  return (
    <>
      <AccountToolbar
        account={selected}
        actions={
          <Button
            disabled={isLoading}
            onClick={handleReload}
          >
            {isLoading ? (
              <RotateCw className="size-4 animate-spin" />
            ) : (
              <RotateCw className="size-4" />
            )}
            Reload
          </Button>
        }
      />

      <p className="text-sm text-muted-foreground">
        Showing friends for{' '}
        <span className="font-medium text-foreground">
          {parseCustomDisplayName(selected)}
        </span>
        .
      </p>

      <StatRow>
        <StatTile
          icon={Users}
          label="Friends"
          value={grouped.friends.length}
        />
        <StatTile
          icon={UserPlus}
          label="Incoming"
          tone={grouped.incoming.length > 0 ? 'primary' : 'default'}
          value={grouped.incoming.length}
        />
        <StatTile
          label="Sent"
          value={grouped.outgoing.length}
        />
        <StatTile
          icon={Ban}
          label="Blocked"
          value={grouped.blocked.length}
        />
      </StatRow>

      <Panel className="flex flex-col gap-3 p-4">
        <FriendsWorkspace
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
      </Panel>
    </>
  )
}
