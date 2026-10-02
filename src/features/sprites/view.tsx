import { useState } from 'react'
import { Ghost, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSpritesAllStore, useSpritesAllSync } from '../../state/management/sprites-all'
import {
  useSpriteHistoryStore,
  useSpriteHistorySync,
} from '../../state/management/sprite-history'
import { useGetAccounts } from '../../hooks/accounts'

import {
  EmptyState,
  PageHeader,
  PageTabPanel,
  PageTabs,
  RefreshButton,
  ToolBadges,
} from '../../components/page'

import { AllAccountsTab } from './all-accounts'
import { CollectionTab } from './collection'
import { HistoryTab } from './history'
import { useSpritesPage } from './hooks'
import { RecoveryTab } from './recovery'

type Tab = 'collection' | 'all' | 'recovery' | 'history'

/**
 * Sprites: one account's collection, every account side by side, what the
 * Sprite Dust can bring back, and what changed between reads.
 *
 * Collection and Recovery are the selected account; All accounts is a
 * sweep the main process runs over every linked account; History is the
 * log `SpriteHistory` keeps on disk. The header's Refresh does what the tab
 * in front of it needs.
 */
export function SpritesPage() {
  const { t } = useTranslation(['sidebar'])
  const { account, catalogue: readCatalogue, collection, errorMessage, handleReload, isLoading } =
    useSpritesPage()
  // History pushes on every change, so it has the latest catalogue news,
  // including a version move found during a sweep.
  const catalogue =
    useSpriteHistoryStore((state) => state.payload?.catalogue) ?? readCatalogue
  const { accountsArray } = useGetAccounts()
  const sweepRunning = useSpritesAllStore((state) => state.running)
  const requestSweep = useSpritesAllStore((state) => state.request)
  const [tab, setTab] = useState<Tab>('collection')

  useSpritesAllSync()
  useSpriteHistorySync()

  const lostCount = collection?.lostVariants ?? 0

  const noAccount = (
    <EmptyState
      description="Pick one in the title bar and its sprite collection loads here."
      icon={UserX}
      title="No account selected"
    />
  )

  return (
    <>
      <PageHeader
        actions={
          tab === 'all' ? (
            <RefreshButton
              disabled={accountsArray.length === 0}
              label="Read all accounts"
              loading={sweepRunning}
              onClick={() => requestSweep(true)}
            />
          ) : (
            <RefreshButton
              disabled={!account}
              loading={isLoading}
              onClick={handleReload}
            />
          )
        }
        description="Every sprite Battle Royale has released and each of its treatments: what your accounts own, what they lost in the field, what Sprite Dust can bring back, and what changed since Penny last looked."
        icon={Ghost}
        section={t('account-management.title')}
        status={<ToolBadges beta readOnly />}
        title="Sprites"
      />

      <PageTabs
        label="Sprites"
        onValueChange={setTab}
        tabs={[
          { value: 'collection', label: 'Collection' },
          { value: 'all', label: 'All accounts' },
          {
            value: 'recovery',
            label:
              lostCount > 0
                ? `Recovery · ${lostCount.toLocaleString()}`
                : 'Recovery',
          },
          { value: 'history', label: 'History' },
        ]}
        value={tab}
      >
        <PageTabPanel
          activeValue={tab}
          value="collection"
        >
          {account ? (
            <CollectionTab
              catalogue={catalogue}
              collection={collection}
              errorMessage={errorMessage}
              isLoading={isLoading}
              key={account.accountId}
            />
          ) : (
            noAccount
          )}
        </PageTabPanel>

        <PageTabPanel
          activeValue={tab}
          value="all"
        >
          <AllAccountsTab />
        </PageTabPanel>

        <PageTabPanel
          activeValue={tab}
          value="recovery"
        >
          {account ? (
            <RecoveryTab
              collection={collection}
              isLoading={isLoading}
              key={account.accountId}
            />
          ) : (
            noAccount
          )}
        </PageTabPanel>

        <PageTabPanel
          activeValue={tab}
          value="history"
        >
          <HistoryTab />
        </PageTabPanel>
      </PageTabs>

      <p className="text-xs text-muted-foreground">
        Ownership, mastery and Sprite Dust come from each account’s own sprite
        inventory at Epic; summon costs from Epic’s catalogue, which lists only
        what can be summoned now. Names and art are bundled with Penny. History
        starts the first time Penny reads an account. Penny never summons,
        equips or spends anything.
      </p>
    </>
  )
}
