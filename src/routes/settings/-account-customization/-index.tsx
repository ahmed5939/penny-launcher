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
  Panel,
  PanelBody,
} from '../../../components/page'
import { Input } from '../../../components/ui/input'
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
      {/* The accordion trigger already names this section. */}
      <div className="border-b border-border/60 px-5 py-3.5">
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          {t('account-customization.description')}
        </p>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground/60">
          {t('account-customization.note')}
        </p>
      </div>
      <PanelBody className="grid gap-3">
        {accountsArray.length > 1 && (
          <div className="mb-2">
            <Input
              className="pr-20"
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
          </div>
        )}
        {accounts.length > 0 ? (
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
        ) : (
          <EmptyState
            title={t('form.accounts.search-empty', {
              ns: 'general',
            })}
          />
        )}
      </PanelBody>
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
    <div
      ref={setNodeRef}
      className={cn(
        'bg-background flex gap-1 items-center outline-muted-foreground/20 rounded',
        data?.className,
        className
      )}
      style={style}
      {...attributes}
    >
      <div
        className={cn(
          'bg-muted-foreground/5 cursor-grab flex flex-shrink-0 h-full items-center px-2 rounded',
          data?.handleClassName
        )}
        {...listeners}
      >
        <div>
          <GripVertical />
        </div>
      </div>
      {children}
    </div>
  )
}
