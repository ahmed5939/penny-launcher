import type { NavItem } from '../../config/navigation'

import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { navSections } from '../../config/navigation'
import { AutomationStatusType } from '../../config/constants/automation'

import { BetaBadge } from '../navigation/beta-badge'
import { StatusDot } from '../page'

import { useGetAccounts } from '../../hooks/accounts'
import { useGetAutomationDataStatus } from '../../hooks/stw-operations/automation'
import { useGetTaxiServiceDataStatus } from '../../hooks/stw-operations/taxi-service'
import { useCustomizableMenuSettingsVisibility } from '../../hooks/settings'

import { cn } from '../../lib/utils'

/**
 * Navigation rail. Destinations only, grouped by job.
 *
 * Quiet group labels replace a wall of 20 undifferentiated links. Every
 * destination is still one click — the labels are not menus.
 */
export function AccountRail() {
  const { t } = useTranslation(['sidebar', 'general'])

  const pathname = useLocation({ select: (location) => location.pathname })
  const { accountsArray } = useGetAccounts()
  const { status: autoKick } = useGetAutomationDataStatus()
  const { status: taxi } = useGetTaxiServiceDataStatus()
  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()

  const areThereAccounts = accountsArray.length > 0
  const statuses = { 'auto-kick': autoKick, 'taxi-service': taxi }

  return (
    <aside className="chrome-surface flex w-48 shrink-0 flex-col border-r border-border/60">
      <nav className="flex-1 overflow-y-auto px-1.5 py-1.5">
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
                  isActive={pathname === section.to}
                  item={{
                    icon: section.icon,
                    label: section.label,
                    to: section.to,
                  }}
                  label={t(section.label)}
                />
              </div>
            ) : null
          }

          return (
            <div key={section.key}>
              {sectionIndex > 0 && (
                <p className="micro-label px-2 pb-1 pt-3 text-muted-foreground/70">
                  {t(section.label)}
                </p>
              )}
              {items.map((item) => (
                <NavRow
                  key={`${item.to}-${item.label}`}
                  // Match up to the first `$param`, so a parameterized entry
                  // highlights for every value of the parameter.
                  isActive={pathname.startsWith(item.to.split('/$')[0])}
                  isDisabled={item.needsAccount && !areThereAccounts}
                  item={item}
                  label={item.label === 'EULA' ? 'EULA' : t(item.label)}
                  status={item.status ? statuses[item.status] : null}
                />
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

function NavRow({
  isActive,
  isDisabled,
  item,
  label,
  status,
}: {
  isActive: boolean
  isDisabled?: boolean
  item: Pick<NavItem, 'beta' | 'icon' | 'params' | 'to'> & { label: string }
  label: string
  status?: AutomationStatusType | null
}) {
  const Icon = item.icon

  const body = (
    <>
      <Icon className="size-4 shrink-0 opacity-75" />
      <span className="flex-1 truncate">{label}</span>
      {item.beta && <BetaBadge />}
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
    'relative flex h-8 items-center gap-2.5 rounded-lg px-2 text-[0.8125rem]',
    'text-muted-foreground',
    !isDisabled && 'hover:bg-accent/30 hover:text-foreground',
    isActive && 'bg-accent/70 font-medium text-foreground',
    isDisabled && 'pointer-events-none opacity-45'
  )

  if (isDisabled) {
    return <span className={className}>{body}</span>
  }

  return (
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
}
