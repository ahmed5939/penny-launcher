import type { MenuKey, NavItem } from '../../config/navigation'

import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { navSections, resolveNavLabel, visibilityKeys } from '../../config/navigation'
import { AutomationStatusType } from '../../config/constants/automation'

import { BetaBadge } from '../navigation/beta-badge'
import { StatusDot } from '../page'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/context-menu'

import { RailAccountSwitcher } from './rail-account-switcher'
import { RailCustomize } from './rail-customize'

import { useGetAccounts } from '../../hooks/accounts'
import { useGetAutomationDataStatus } from '../../hooks/stw-operations/automation'
import { useGetTaxiServiceDataStatus } from '../../hooks/stw-operations/taxi-service'
import {
  useCustomizableMenuSettingsActions,
  useCustomizableMenuSettingsVisibility,
} from '../../hooks/settings'

import { cn } from '../../lib/utils'

/**
 * Navigation rail: accounts, then destinations, then customize.
 *
 * The roster sits at the top so switching accounts is one click, the way
 * the rest of the desktop launcher is. Destinations honour the customizable
 * menu; hidden tools stay in ⌘K rather than disappearing from the app.
 */
export function AccountRail() {
  const { t } = useTranslation(['sidebar', 'general'])

  const pathname = useLocation({ select: (location) => location.pathname })
  const { accountsArray } = useGetAccounts()
  const { status: autoKick } = useGetAutomationDataStatus()
  const { status: taxi } = useGetTaxiServiceDataStatus()
  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()

  const areThereAccounts = accountsArray.some(
    (account) => account.authStatus !== 'invalid'
  )
  const statuses = { 'auto-kick': autoKick, 'taxi-service': taxi }

  return (
    <aside
      className="chrome-surface flex w-52 shrink-0 flex-col border-r border-border/60 max-[900px]:w-14"
      data-app-focus-region="accounts"
      tabIndex={-1}
    >
      <RailAccountSwitcher />

      <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
        {navSections.map((section, sectionIndex) => {
          const validateChildren = section.items.length > 0

          if (
            section.can &&
            !getMenuOptionVisibility(section.can, validateChildren)
          ) {
            return null
          }

          const items = section.items.filter(
            (item) =>
              (!item.can || getMenuOptionVisibility(item.can)) &&
              (!item.canAny ||
                item.canAny.some((key) => getMenuOptionVisibility(key)))
          )

          // A section with no children is itself the destination (Home, Add-ons).
          if (items.length === 0) {
            return section.to ? (
              <div key={section.key}>
                {sectionIndex > 0 && (
                  <div className="mx-2 my-1.5 h-px bg-border/60" />
                )}
                <NavRow
                  hideKeys={section.can ? [section.can] : []}
                  isActive={pathname === section.to}
                  item={{
                    icon: section.icon,
                    label: section.label,
                    to: section.to,
                  }}
                  label={resolveNavLabel(t, section.label)}
                />
              </div>
            ) : null
          }

          return (
            <div key={section.key}>
              {sectionIndex > 0 && (
                <p className="micro-label px-2 pb-1 pt-3 text-muted-foreground/70 max-[900px]:hidden">
                  {t(section.label)}
                </p>
              )}
              {items.map((item) => (
                <NavRow
                  key={`${item.to}-${item.label}`}
                  hideKeys={visibilityKeys(item)}
                  // Match up to the first `$param`, so a parameterized entry
                  // highlights for every value of the parameter.
                  isActive={pathname.startsWith(item.to.split('/$')[0])}
                  isDisabled={item.needsAccount && !areThereAccounts}
                  item={item}
                  label={resolveNavLabel(t, item.label)}
                  status={item.status ? statuses[item.status] : null}
                />
              ))}
            </div>
          )
        })}
      </nav>

      <RailCustomize />
    </aside>
  )
}

function NavRow({
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
      <span className="flex-1 truncate max-[900px]:sr-only">{label}</span>
      {item.beta && <span className="max-[900px]:hidden"><BetaBadge /></span>}
      {status != null && (
        <StatusDot
          tone={
            status === AutomationStatusType.ISSUE ? 'warning' : 'active'
          }
        />
      )}
    </>
  )

  const className = cn(
    'relative flex h-8 items-center gap-2.5 rounded-lg px-2 text-[0.8125rem] max-[900px]:justify-center max-[900px]:px-1',
    'text-muted-foreground',
    !isDisabled && 'hover:bg-accent/30 hover:text-foreground',
    isActive && 'bg-accent/70 font-medium text-foreground',
    isDisabled && 'pointer-events-none opacity-45'
  )

  const row = isDisabled ? (
    <span className={className}>{body}</span>
  ) : (
    <Link
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
