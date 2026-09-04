import { Link } from '@tanstack/react-router'
import { ChevronDown, ShieldAlert, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAccountList } from '../account-list/hooks'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { AccountGlyph, AccountRoster } from './account-roster'
import { parseCustomDisplayName } from '../../lib/utils'

export function AccountSwitcher() {
  const { t } = useTranslation(['sidebar'])
  const model = useAccountList()
  const { selected, members, accounts, open, setOpen } = model
  const name = selected ? parseCustomDisplayName(selected) : t('add-account')
  const hasIssue = accounts.some((account) => account.authStatus === 'invalid')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 min-w-0 items-center gap-2 rounded-lg border border-border/60 px-2 text-xs hover:bg-accent/30"
          title={`${t('primary-account')}: ${name}. ${t('account-scope')}: ${members.length}`}
        >
          {selected ? (
            <AccountGlyph accountId={selected.accountId} name={name} selected />
          ) : (
            <Users className="size-4" />
          )}
          <span className="max-w-40 truncate max-[700px]:max-w-20">{name}</span>
          {members.length > 1 && (
            <span className="hidden text-muted-foreground sm:inline">
              {members.length} {t('account-scope').toLocaleLowerCase()}
            </span>
          )}
          {hasIssue && (
            <ShieldAlert
              className="size-3.5 text-warning"
              aria-label={t('account-attention')}
            />
          )}
          <ChevronDown className="size-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] p-2"
      >
        <AccountRoster model={model} />
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-3 text-xs">
          <Link
            to="/accounts/add/$type"
            params={{ type: 'authorization-code' }}
            onClick={() => setOpen(false)}
            className="hover:underline"
          >
            {t('add-account')}
          </Link>
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className="hover:underline"
          >
            {t('manage-accounts')} →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
