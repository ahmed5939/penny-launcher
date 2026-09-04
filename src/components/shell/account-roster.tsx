import {
  Check,
  CheckCheck,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Input } from '../ui/input'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'

import type { useAccountList } from '../account-list/hooks'

import { cn, parseCustomDisplayName } from '../../lib/utils'

export function AccountRoster({
  model,
}: {
  model: ReturnType<typeof useAccountList>
}) {
  const [query, setQuery] = useState('')
  const { t } = useTranslation(['general', 'sidebar'])

  const {
    accounts,
    allSelected,
    members,
    onClearScope,
    onContextMenu,
    onSelect,
    onSelectAll,
    onToggleMember,
    selected,
    createKeywords,
  } = model
  const isChecking = accounts.some(
    (account) => account.authStatus === 'checking',
  )

  return (
    <div className="border-b border-border/60 px-1.5 py-1.5">
      <div className="flex items-center px-2 pb-1 pt-0.5">
        <p className="micro-label text-muted-foreground/70">
          {t('sidebar:customize.accounts')}
        </p>
        {accounts.length > 0 && (
          <Button
            aria-label="Check all account statuses"
            className="ml-auto size-5 p-0 text-muted-foreground"
            disabled={isChecking}
            size="icon"
            title="Check all account statuses"
            variant="ghost"
            onClick={() => window.electronAPI.checkAllAccountStatuses()}
          >
            {isChecking ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
          </Button>
        )}
      </div>

      {accounts.length === 0 ? (
        <Link
          to="/accounts/add/$type"
          params={{ type: 'authorization-code' }}
          className="flex h-8 items-center gap-2 rounded-lg px-2 text-[0.8125rem] text-muted-foreground hover:bg-accent/30 hover:text-foreground"
        >
          <UserPlus className="size-4 shrink-0 opacity-75" />
          <span className="truncate">
            {t('form.accounts.no-registered-accounts')}
          </span>
        </Link>
      ) : (
        <>
          <Input
            autoFocus
            className="mb-2"
            aria-label={t('sidebar:search-accounts')}
            placeholder={t('sidebar:search-accounts')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="mb-2 px-2 text-xs text-muted-foreground">
            {t('sidebar:primary-account')} · {t('sidebar:account-scope')}
          </p>
          <ul className="max-h-[min(22rem,50vh)] overflow-y-auto">
            {accounts.map((account, index) => {
              if (
                query.trim() &&
                !createKeywords(account)?.some((keyword) =>
                  keyword
                    .toLocaleLowerCase()
                    .includes(query.trim().toLocaleLowerCase()),
                )
              )
                return null
              const displayName = parseCustomDisplayName(account)
              const isCurrent = selected?.accountId === account.accountId
              const isInScope = members.includes(account.accountId)
              const shortcut = index < 9 ? `Ctrl+${index + 1}` : undefined
              const isInvalid = account.authStatus === 'invalid'
              const isAccountChecking = account.authStatus === 'checking'
              const isValid = account.authStatus === 'valid'

              return (
                <li key={account.accountId}>
                  <div
                    className={cn(
                      'relative flex h-8 items-center gap-1.5 rounded-lg px-1.5',
                      'text-[0.8125rem] text-muted-foreground',
                      !isInvalid && 'hover:bg-accent/30 hover:text-foreground',
                      isCurrent && 'bg-accent/70 font-medium text-foreground',
                      isInvalid && 'opacity-45 grayscale',
                    )}
                    onContextMenu={onContextMenu(account)}
                  >
                    {isCurrent && (
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-primary" />
                    )}
                    <button
                      type="button"
                      disabled={isInvalid}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={
                        isInvalid
                          ? `${displayName} — authentication expired; re-add this account to authenticate again`
                          : shortcut
                            ? `${displayName} (${shortcut})`
                            : displayName
                      }
                      onClick={() => onSelect(account)(account.accountId)}
                    >
                      <AccountGlyph
                        accountId={account.accountId}
                        name={displayName}
                        selected={isCurrent}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {displayName}
                      </span>
                      {isInvalid && (
                        <ShieldAlert className="size-3.5 shrink-0" />
                      )}
                      {isAccountChecking && (
                        <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
                      )}
                      {isValid && !isCurrent && (
                        <ShieldCheck className="size-3.5 shrink-0 text-emerald-500" />
                      )}
                      {isCurrent && (
                        <Check className="size-3.5 shrink-0 text-primary" />
                      )}
                    </button>
                    {accounts.length > 1 && (
                      <Checkbox
                        aria-label={`${t('sidebar:account-scope')}: ${displayName}`}
                        checked={isInScope}
                        disabled={isInvalid}
                        className="ml-0.5"
                        size="sm"
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() =>
                          onToggleMember(account.accountId)
                        }
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {accounts.every(
            (account) =>
              !createKeywords(account)?.some((keyword) =>
                keyword
                  .toLocaleLowerCase()
                  .includes(query.trim().toLocaleLowerCase()),
              ),
          ) && (
            <p className="p-3 text-sm text-muted-foreground">
              {t('no-item-found')}
            </p>
          )}

          {accounts.length > 1 && (
            <div className="mt-1 flex items-center gap-1 px-1">
              <span className="figure mr-auto px-1 text-[0.625rem] text-muted-foreground">
                {t('form.multi.select.counter', {
                  selected: members.length,
                  total: accounts.length,
                })}
              </span>
              <ScopeAction disabled={allSelected} onClick={onSelectAll}>
                <CheckCheck className="size-3" />
                {t('sidebar:all-accounts')}
              </ScopeAction>
              <ScopeAction
                disabled={members.length <= 1}
                onClick={onClearScope}
              >
                <X className="size-3" />
                {t('sidebar:only-primary')}
              </ScopeAction>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function AccountGlyph({
  accountId,
  name,
  selected,
}: {
  accountId: string
  name: string
  selected: boolean
}) {
  return (
    <span
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-md text-[0.5625rem] font-semibold uppercase text-white',
        selected ? 'ring-1 ring-primary/70' : 'opacity-90',
      )}
      style={{ backgroundColor: `hsl(${accountHue(accountId)} 42% 36%)` }}
    >
      {name.slice(0, 1)}
    </span>
  )
}

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
      className="h-6 gap-1 px-1.5 text-[0.625rem] font-medium text-muted-foreground"
      disabled={disabled}
      size="sm"
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function accountHue(accountId: string) {
  let hash = 0

  for (let index = 0; index < accountId.length; index += 1) {
    hash = (hash * 33 + accountId.charCodeAt(index)) >>> 0
  }

  return hash % 360
}
