import { Check, CheckCheck, ChevronsUpDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../ui/button'
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
 * the bulk scope, and All/Clear covers the two moves people actually make.
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
            'not-draggable-region flex h-7 justify-between pl-3 pr-2 select-none text-left text-xs w-52',
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
              <span className="block truncate max-w-[10rem] w-full">
                {triggerLabel}
              </span>
              <ChevronsUpDown className="h-4 ml-auto opacity-50 shrink-0 w-4" />
            </>
          ) : (
            <span className="leading-4 text-balance truncate">
              {t('form.accounts.no-registered-accounts')}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-60">
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
                    key={account.accountId}
                    value={account.accountId}
                    keywords={createKeywords(account)}
                    onSelect={onSelect(account)}
                    onContextMenu={onContextMenu(account)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
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
                    <button
                      type="button"
                      aria-label={
                        isInScope ? 'Remove from scope' : 'Add to scope'
                      }
                      className={cn(
                        'ml-auto grid size-4 shrink-0 place-items-center rounded-[3px] border',
                        isInScope
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/50'
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleMember(account.accountId)
                      }}
                    >
                      {isInScope && <Check className="size-3" />}
                    </button>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandListWithScrollArea>

          {accounts.length > 1 && (
            <div className="flex items-center gap-1 border-t border-border/60 px-1.5 py-1">
              <span className="px-1 text-[0.6875rem] tabular-nums text-muted-foreground">
                {members.length} of {accounts.length} in scope
              </span>
              <button
                type="button"
                className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={onSelectAll}
                disabled={allSelected}
              >
                <CheckCheck className="size-3" />
                All
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={onClearScope}
                disabled={members.length <= 1}
              >
                <X className="size-3" />
                Clear
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
