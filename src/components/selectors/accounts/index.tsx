import type {
  SelectCustomFilter,
  SelectOption,
} from '../../ui/third-party/extended/input-tags'

import { CheckCheck, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { InputTags } from '../../ui/third-party/extended/input-tags'

import { useAccountsInputTagsCustomFilter } from './hooks'

import { cn } from '../../../lib/utils'

/**
 * Account picker used by every bulk operation.
 *
 * Selection used to be split across two inputs — accounts and tags — where
 * tags carried hidden "bulk" keywords that silently meant "every account".
 * A single list with an explicit select-all does the same job without the
 * indirection, and always shows exactly how many accounts an action covers.
 */
export function AccountSelectors({
  accounts,
  customFilters,
  isDisabled,
  onUpdateAccounts,
}: {
  accounts: {
    options: Array<SelectOption>
    value: Array<SelectOption>
  }
  customFilters?: Partial<{
    accounts: SelectCustomFilter
  }>
  isDisabled?: boolean
  onUpdateAccounts?: (value: Array<SelectOption>) => void
}) {
  const { t } = useTranslation(['general'])

  const { filter } = useAccountsInputTagsCustomFilter()

  const total = accounts.options.length
  const selected = accounts.value.length
  const allSelected = total > 0 && selected >= total

  const update = onUpdateAccounts ?? (() => {})

  return (
    <div className="grid gap-2">
      <InputTags
        placeholder={t('form.multi.select.accounts')}
        options={accounts.options}
        value={accounts.value}
        onChange={update}
        isDisabled={isDisabled}
        customFilter={customFilters?.accounts ?? filter}
      />

      <div className="flex items-center gap-2 px-0.5">
        <span className="text-xs tabular-nums text-muted-foreground">
          {t('form.multi.select.counter', {
            selected,
            total,
          })}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <SelectorAction
            disabled={isDisabled || allSelected || total === 0}
            onClick={() => update(accounts.options)}
          >
            <CheckCheck className="size-3.5" />
            {t('form.multi.select.all')}
          </SelectorAction>
          <SelectorAction
            disabled={isDisabled || selected === 0}
            onClick={() => update([])}
          >
            <X className="size-3.5" />
            {t('form.multi.select.clear')}
          </SelectorAction>
        </div>
      </div>
    </div>
  )
}

function SelectorAction({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
        'text-muted-foreground transition-colors',
        'hover:bg-accent/60 hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-40'
      )}
    >
      {children}
    </button>
  )
}
