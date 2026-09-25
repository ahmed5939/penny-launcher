import { Contact } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  EmptyState,
  PageHeader,
  RefreshButton,
  StatRow,
  StatTile,
} from '../../../components/page'

import { FriendsWorkspace } from '../../../components/friends/workspace'
import { useFriendsHub } from '../../../components/friends/hooks'

import { parseCustomDisplayName } from '../../../lib/utils'

/**
 * The social screen: the roster is the page, adding someone sits beside it,
 * and the four counts across the top answer "anything waiting on me?".
 * The docked panel is the same workspace in a narrower frame.
 */
export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])
  const hub = useFriendsHub()
  const { grouped, handleReload, isLoading, selected } = hub

  return (
    <>
      <PageHeader
        actions={
          <RefreshButton
            disabled={!selected}
            loading={isLoading}
            onClick={handleReload}
          />
        }
        description={
          selected ? (
            <>
              Friends of{' '}
              <span className="font-medium text-foreground">
                {parseCustomDisplayName(selected)}
              </span>
              . Invite them to your party, answer requests, or add someone new.
            </>
          ) : (
            'Invite friends to your party, answer requests, or add someone new.'
          )
        }
        icon={Contact}
        section={t('account-management.title')}
        title={t('account-management.options.friends')}
      />

      {!selected ? (
        <EmptyState
          icon={Contact}
          title="No account selected"
          description="Pick one in the title bar and its friends load here."
        />
      ) : (
        <>
          <StatRow>
            <StatTile
              label="Friends"
              value={grouped.friends.length.toLocaleString()}
            />
            <StatTile
              hint={grouped.incoming.length > 0 ? 'Waiting for an answer' : undefined}
              label="Incoming"
              tone={grouped.incoming.length > 0 ? 'primary' : 'default'}
              value={grouped.incoming.length.toLocaleString()}
            />
            <StatTile
              label="Sent"
              value={grouped.outgoing.length.toLocaleString()}
            />
            <StatTile
              label="Blocked"
              value={grouped.blocked.length.toLocaleString()}
            />
          </StatRow>

          <FriendsWorkspace
            data={hub}
            key={selected.accountId}
            layout="page"
          />
        </>
      )}
    </>
  )
}
