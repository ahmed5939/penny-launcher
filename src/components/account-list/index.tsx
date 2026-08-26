import { Check, CheckCheck, ChevronsUpDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandListWithScrollArea,
} from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

import { useCustomizableMenuSettingsVisibility } from '../../hooks/settings'
import { useAccountList } from './hooks'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * The account control. Singular on purpose.
 *
 * Everything about "who is this app pointed at" happens in this one dropdown:
 * clicking a name makes it the account, the box beside each name adds it to
 * the bulk scope, and the strip under the list covers the two moves people
 * actually make.
 * No page carries its own picker and the rail carries no account list —
 * having the same choice in two places meant neither could be trusted.
 */
export function AccountList() {
  const { t } = useTranslation(['general'])

  const {
    accounts,
    allSelected,
    createKeywords,
    customFilter,
    members,
    onClearScope,
    onContextMenu,
    onSelect,
    onSelectAll,
    onToggleMember,
    open,
    selected,
    setOpen,
  } = useAccountList()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  const triggerLabel = selected
    ? members.length > 1
      ? `${parseCustomDisplayName(selected)} +${members.length - 1}`
      : parseCustomDisplayName(selected)
    : t('form.accounts.select')

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          className={cn(
            // h-7 rather than the 32px standard: this one sits inside the
            // 40px titlebar, alongside the search field and friends toggle.
            'not-draggable-region flex h-7 w-52 justify-between pl-3 pr-2 text-left text-xs select-none',
            {
              'justify-center px-2': accounts.length < 1,
            }
          )}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={accounts.length < 1}
        >
          {accounts.length > 0 ? (
            <>
              <span className="block w-full max-w-[10rem] truncate">
                {triggerLabel}
              </span>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
            </>
          ) : (
            <span className="truncate text-balance leading-4">
              {t('form.accounts.no-registered-accounts')}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0">
        <Command
          filter={customFilter}
          loop
        >
          {accounts.length > 1 && (
            <CommandInput
              placeholder={t('form.accounts.placeholder', {
                ns: 'general',
                context: !getMenuOptionVisibility('showTotalAccounts')
                  ? 'private'
                  : undefined,
                total: accounts.length,
              })}
              className="select-none"
              disabled={accounts.length <= 1}
            />
          )}
          <CommandListWithScrollArea>
            <CommandEmpty>{t('form.accounts.search-empty')}</CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => {
                const displayName = parseCustomDisplayName(account)
                const isCurrent =
                  selected?.accountId === account.accountId
                const isInScope = members.includes(account.accountId)

                return (
                  <CommandItem
                    className="gap-2"
                    key={account.accountId}
                    value={account.accountId}
                    keywords={createKeywords(account)}
                    onSelect={onSelect(account)}
                    onContextMenu={onContextMenu(account)}
                  >
                    <Check
                      className={cn(
                        'size-4 shrink-0',
                        isCurrent ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span
                      className="max-w-[9rem] truncate"
                      title={displayName}
                    >
                      {displayName}
                    </span>
                    {/*
                      Scope membership, right on the row. A separate
                      multi-select somewhere else is how the app ended up with
                      twelve pickers.
                    */}
                    <Checkbox
                      aria-label={
                        isInScope ? 'Remove from scope' : 'Add to scope'
                      }
                      checked={isInScope}
                      className="ml-auto"
                      size="sm"
                      /*
                       * The row itself switches account on click, so the box
                       * has to keep its own click to itself.
                       */
                      onClick={(event) => event.stopPropagation()}
                      onCheckedChange={() =>
                        onToggleMember(account.accountId)
                      }
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandListWithScrollArea>

          {accounts.length > 1 && (
            <div className="flex items-center gap-1 border-t border-border/60 px-1.5 py-1">
              <span className="figure mr-auto px-1 text-[0.6875rem] text-muted-foreground">
                {t('form.multi.select.counter', {
                  selected: members.length,
                  total: accounts.length,
                })}
              </span>
              <ScopeAction
                disabled={allSelected}
                onClick={onSelectAll}
              >
                <CheckCheck className="size-3" />
                {t('form.multi.select.all')}
              </ScopeAction>
              <ScopeAction
                /* The scope may never be emptied, so the last member stays. */
                disabled={members.length <= 1}
                onClick={onClearScope}
              >
                <X className="size-3" />
                {t('form.multi.select.clear')}
              </ScopeAction>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * A scope-strip action.
 *
 * A `Button` at its own smallest size, pulled down again: the strip is 240px
 * wide and carries two labelled actions beside a counter, which the 32px
 * control height cannot fit. Everything that decides how it behaves — the
 * ghost hover, the disabled treatment, the icon gap — still comes from the
 * primitive.
 */
function ScopeAction({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      className="h-6 gap-1 px-1.5 text-[0.6875rem] font-medium text-muted-foreground"
      disabled={disabled}
      size="sm"
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
