import type { ItemRecordMap } from '../../../state/items/database'
import type { QuestList } from './-hooks'

import { useState } from 'react'
import { Pin, ScrollText, Trash2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import { ItemIcon } from '../../../components/items/item-icon'
import {
  Callout,
  Chip,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  PanelHeader,
  SearchField,
} from '../../../components/page'

import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useData } from './-hooks'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Pin}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.auto-pin-urns')}
        description="Keeps the quests you pick pinned, re-pinning repeatables after their rewards are claimed."
      />
      <Content />
    </>
  )
}

export function Content() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const {
    accounts,
    accountSelectorIsDisabled,
    options,
    records,
    selectedAccounts,
    questLists,

    customFilter,
    handleRemoveAccount,
    handleUpdateAccount,
    onSelectItem,
    retry,
  } = useData()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  const picker = (
    <div className="w-56">
      <Combobox
        placeholder="Add an account"
        placeholderSearch={t('form.accounts.placeholder', {
          ns: 'general',
          context: !getMenuOptionVisibility('showTotalAccounts') ? 'private' : undefined,
          total: options.length,
        })}
        emptyPlaceholder={t('form.accounts.no-options', { ns: 'general' })}
        emptyContent={t('form.accounts.search-empty', { ns: 'general' })}
        options={options}
        value={[]}
        customFilter={customFilter}
        onChange={() => {}}
        onSelectItem={onSelectItem}
        emptyContentClassname="py-6 text-center text-sm"
        disabled={accountSelectorIsDisabled}
        disabledItem={accountSelectorIsDisabled}
        inputSearchIsDisabled={accountSelectorIsDisabled}
        hideInputSearchWhenOnlyOneOptionIsAvailable
        hideSelectorOnSelectItem
      />
    </div>
  )

  return (
    <div className="space-y-5">
      {accounts.length <= 0 ? (
        <Panel>
          <PanelHeader actions={picker} compact icon={Pin} title="Accounts" />
          <EmptyState
            className="border-0 bg-transparent py-10"
            description="Add an account, then pick the quests to keep pinned."
            icon={UserPlus}
            title="No accounts on auto-pin"
          />
        </Panel>
      ) : (
        <>
          <div className="flex justify-end">{picker}</div>
          {accounts.map((account) => (
            <AccountQuests
              key={account.accountId}
              list={questLists[account.accountId] ?? { status: 'loading' }}
              loadingLabel={t('urns.loading')}
              name={parseCustomDisplayName(account) ?? account.displayName}
              onRemove={handleRemoveAccount(account.accountId)}
              onRetry={() => retry(account.accountId)}
              onToggle={(templateId, value) => handleUpdateAccount(account.accountId, templateId)(value)}
              pinned={selectedAccounts[account.accountId] ?? []}
              records={records}
            />
          ))}
        </>
      )}
    </div>
  )
}

function AccountQuests({
  list,
  loadingLabel,
  name,
  onRemove,
  onRetry,
  onToggle,
  pinned,
  records,
}: {
  list: QuestList
  loadingLabel: string
  name: string
  onRemove: () => void
  onRetry: () => void
  onToggle: (templateId: string, value: boolean) => void
  pinned: Array<string>
  records: ItemRecordMap
}) {
  const [search, setSearch] = useState('')
  const quests = list.status === 'ready' ? list.quests : []
  /* Pinned quests first, so what the automation is doing reads at a glance. */
  const shown = quests
    .filter((quest) => quest.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(pinned.includes(b.templateId)) - Number(pinned.includes(a.templateId)))

  return (
    <Panel>
      <PanelHeader
        actions={
          <>
            <Chip tone={pinned.length > 0 ? 'accent' : 'neutral'}>
              <Pin aria-hidden className="size-3" />
              {pinned.length} pinned
            </Chip>
            <Button
              aria-label={`Remove ${name} from auto-pin`}
              className="size-8 text-muted-foreground [&:not(:disabled)]:hover:text-destructive"
              onClick={onRemove}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
        compact
        icon={ScrollText}
        title={name}
      />

      {list.status === 'loading' && (
        <p className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-muted-foreground" role="status">
          <ScrollText className="size-4" />
          {loadingLabel}
        </p>
      )}

      {list.status === 'error' && (
        <div className="flex flex-col items-start gap-3 p-4" role="alert">
          <Callout tone="danger">
            Could not load quests for {name} ({list.message}).
          </Callout>
          <Button onClick={onRetry} size="sm" variant="outline">
            Try again
          </Button>
        </div>
      )}

      {list.status === 'ready' && quests.length <= 0 && (
        <EmptyState
          className="border-0 bg-transparent py-8"
          description="This account's quest log is empty."
          title="No active quests"
        />
      )}

      {list.status === 'ready' && quests.length > 0 && (
        <>
          <FilterBar>
            <SearchField label={`Find quests for ${name}`} onChange={setSearch} placeholder="Search quests…" value={search} />
          </FilterBar>
          <ul className="grid max-h-[32rem] gap-px overflow-y-auto bg-border/40 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((quest) => {
              const on = pinned.includes(quest.templateId)

              return (
                <li className="bg-card" key={quest.templateId}>
                  <button
                    aria-label={`${on ? 'Stop pinning' : 'Keep pinned'}: ${quest.name}`}
                    aria-pressed={on}
                    className={cn(
                      'flex h-full w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      on ? 'bg-primary/10' : 'hover:bg-accent/30',
                    )}
                    onClick={() => onToggle(quest.templateId, !on)}
                    type="button"
                  >
                    <ItemIcon records={records} templateId={quest.templateId} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-ui font-medium leading-snug">{quest.name}</span>
                      {!quest.active && <span className="mt-0.5 block text-xs text-warning">Not in the quest log</span>}
                    </span>
                    <Pin aria-hidden className={cn('size-4 shrink-0', on ? 'text-primary' : 'text-muted-foreground')} />
                  </button>
                </li>
              )
            })}
          </ul>
          {shown.length === 0 && (
            <EmptyState className="border-0 bg-transparent py-8" title={`No quest matches “${search}”`} />
          )}
        </>
      )}
    </Panel>
  )
}
