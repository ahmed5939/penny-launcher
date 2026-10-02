import { Link } from '@tanstack/react-router'
import { ChevronDown, ShieldAlert, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAccountList } from '../account-list/hooks'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { AccountAvatar } from '../accounts/account-avatar'
import { AccountRoster } from './account-roster'
import {
  useEquippedSprite,
  useSpriteHistorySync,
} from '../../state/management/sprite-history'
import { spriteIconUrl } from '../../sprite-images'
import { parseCustomDisplayName } from '../../lib/utils'

export function AccountSwitcher() {
  const { t } = useTranslation(['sidebar'])
  const model = useAccountList()
  const { selected, members, accounts, open, setOpen } = model
  const name = selected ? parseCustomDisplayName(selected) : t('add-account')
  const hasIssue = accounts.some((account) => account.authStatus === 'invalid')

  // The shell is always mounted, so this is where the sprite history loads.
  useSpriteHistorySync()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 min-w-0 items-center gap-2 rounded-lg border border-border/60 px-2 text-xs hover:bg-accent/30"
          title={`${t('primary-account')}: ${name}. ${t('account-scope')}: ${members.length}`}
        >
          {selected ? (
            <AccountAvatar
              accountId={selected.accountId}
              className="ring-1 ring-primary/70"
              name={name}
              size="xs"
            >
              <EquippedSpriteBadge accountId={selected.accountId} />
            </AccountAvatar>
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
            params={{ type: 'quick-login' }}
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

/**
 * The account's last-known equipped sprite, tucked into the corner of its
 * avatar. An overlay rather than part of the avatar, so it sits on top of
 * whatever the avatar becomes; nothing at all when no read has said.
 */
function EquippedSpriteBadge({ accountId }: { accountId: string }) {
  const equipped = useEquippedSprite(accountId)
  const url = spriteIconUrl(equipped?.iconFile ?? null)

  if (!equipped || !url) {
    return null
  }

  const label = `Equipped sprite: ${equipped.name}`

  return (
    <img
      alt={label}
      className="absolute -bottom-1 -right-1.5 size-3.5 rounded-full bg-background object-contain ring-1 ring-border"
      draggable={false}
      src={url}
      title={label}
    />
  )
}
