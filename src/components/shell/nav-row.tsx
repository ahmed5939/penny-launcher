import type { MenuKey, NavItem } from '../../config/navigation'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AutomationStatusType } from '../../config/constants/automation'
import { BetaBadge } from '../navigation/beta-badge'
import { StatusDot } from '../page'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu'
import { useCustomizableMenuSettingsActions } from '../../hooks/settings'
import { cn } from '../../lib/utils'

export function NavRow({
  hideKeys,
  isActive,
  isDisabled,
  item,
  label,
  status,
}: {
  hideKeys: Array<MenuKey>
  isActive: boolean
  isDisabled?: boolean
  item: Pick<NavItem, 'beta' | 'icon' | 'params' | 'to'> & { label: string }
  label: string
  status?: AutomationStatusType | null
}) {
  const { t } = useTranslation(['sidebar'])
  const { updateMenuOption } = useCustomizableMenuSettingsActions()
  const Icon = item.icon

  const body = (
    <>
      <Icon className="size-4 shrink-0 opacity-75" />
      <span className="flex-1 truncate">{label}</span>
      {item.beta && (
        <span className="">
          <BetaBadge />
        </span>
      )}
      {status != null && (
        <StatusDot
          tone={status === AutomationStatusType.ISSUE ? 'warning' : 'active'}
        />
      )}
    </>
  )

  const className = cn(
    'relative flex h-8 items-center gap-2.5 rounded-lg px-2 text-[0.8125rem]',
    'text-muted-foreground',
    !isDisabled && 'hover:bg-accent/30 hover:text-foreground',
    isActive && 'bg-accent/70 font-medium text-foreground',
    isDisabled && 'pointer-events-none opacity-45',
  )

  const row = isDisabled ? (
    <span className={className}>{body}</span>
  ) : (
    <Link
      aria-current={isActive ? 'page' : undefined}
      to={item.to}
      params={item.params}
      className={className}
    >
      {isActive && (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-primary" />
      )}
      {body}
    </Link>
  )

  if (hideKeys.length === 0) {
    return row
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{row}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            for (const key of hideKeys) {
              updateMenuOption(key)(false)
            }
          }}
        >
          {t('sidebar:customize.hide')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
