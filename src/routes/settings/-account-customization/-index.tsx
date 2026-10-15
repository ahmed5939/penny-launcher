import type { PropsWithChildren } from 'react'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
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

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function AccountCustomization() {
  const { t } = useTranslation(['settings', 'general'])

  const { accounts, accountsArray, onChangeSearchValue, searchValue } =
    useAccounts()
  const { isPendingSubmitCustomDisplayName, onSubmitCustomDisplayName } =
    useActions()

  const { idsList, reorderAccounts } = useRegisterAccounts()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
      <DndContext
        modifiers={[restrictToFirstScrollableAncestor]}
        onDragEnd={reorderAccounts}
        sensors={sensors}
      >
        <SortableContext
          items={idsList}
          strategy={verticalListSortingStrategy}
        >
          {accounts.length > 0 ? (
            <ul className="divide-y divide-border/30 px-2 py-1">
              {accounts.map((account) => {
                return (
                  <SortableItem
                    id={account.accountId}
                    key={account.accountId}
                    label={parseCustomDisplayName(account)}
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
            </ul>
          ) : (
            <EmptyState
              className="border-0 bg-transparent py-8"
              title={t('form.accounts.search-empty', {
                ns: 'general',
              })}
            />
          )}
        </SortableContext>
      </DndContext>
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
  label,
}: PropsWithChildren<{ className?: string; id: string; label: string }>) {
  const {
    attributes,
    data,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    style,
  } = useOrdering({
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
    >
      <button
        aria-label={`Reorder ${label}`}
        className={cn(
          'flex cursor-grab items-center self-stretch rounded-md px-1.5 text-muted-foreground/60 hover:text-foreground',
          data?.handleClassName
        )}
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      {children}
    </li>
  )
}
