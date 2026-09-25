import type { PropsWithChildren } from 'react'

import { DndContext } from '@dnd-kit/core'
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  EmptyState,
  FilterBar,
  Panel,
  PanelHeader,
  SearchField,
} from '../../../components/page'
import { AccountItem } from './-item'

import { useRegisterAccounts } from '../../../hooks/accounts'
import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useAccounts, useActions, useOrdering } from './-hooks'

import { cn } from '../../../lib/utils'

export function AccountCustomization() {
  const { t } = useTranslation(['settings', 'general'])

  const { accounts, accountsArray, onChangeSearchValue, searchValue } =
    useAccounts()
  const { isPendingSubmitCustomDisplayName, onSubmitCustomDisplayName } =
    useActions()

  const { idsList, reorderAccounts } = useRegisterAccounts()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <Panel>
      <PanelHeader
        compact
        description={t('account-customization.description')}
        title={t('account-customization.title')}
      />
      {accountsArray.length > 1 && (
        <FilterBar>
          <SearchField
            label={t('form.accounts.select', { ns: 'general' })}
            placeholder={t('form.accounts.placeholder', {
              ns: 'general',
              context: !getMenuOptionVisibility('showTotalAccounts')
                ? 'private'
                : undefined,
              total: accountsArray.length,
            })}
            value={searchValue}
            onChange={onChangeSearchValue}
          />
        </FilterBar>
      )}
      {accounts.length > 0 ? (
        <ul className="divide-y divide-border/30 px-2 py-1">
          <DndContext
            modifiers={[restrictToFirstScrollableAncestor]}
            onDragEnd={reorderAccounts}
          >
            <SortableContext
              items={idsList}
              strategy={verticalListSortingStrategy}
            >
              {accounts.map((account) => {
                return (
                  <SortableItem
                    id={account.accountId}
                    key={account.accountId}
                  >
                    <AccountItem
                      account={account}
                      isPendingSubmitCustomDisplayName={
                        isPendingSubmitCustomDisplayName
                      }
                      onSubmitCustomDisplayName={onSubmitCustomDisplayName}
                    />
                  </SortableItem>
                )
              })}
            </SortableContext>
          </DndContext>
        </ul>
      ) : (
        <EmptyState
          className="border-0 bg-transparent py-8"
          title={t('form.accounts.search-empty', {
            ns: 'general',
          })}
        />
      )}
      <p className="border-t border-border/30 px-5 py-3 text-xs text-muted-foreground">
        {t('account-customization.note')}
      </p>
    </Panel>
  )
}

function SortableItem({
  children,
  className,
  id,
}: PropsWithChildren<{ className?: string; id: string }>) {
  const { attributes, data, listeners, setNodeRef, style } = useOrdering({
    id,
  })

  return (
    <li
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-1 rounded-md bg-card py-1.5 pr-3 outline-1 outline-primary/40',
        data?.className,
        className
      )}
      style={style}
      {...attributes}
    >
      <span
        aria-hidden
        className={cn(
          'flex cursor-grab items-center self-stretch px-1.5 text-muted-foreground/60 hover:text-foreground',
          data?.handleClassName
        )}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </span>
      {children}
    </li>
  )
}
