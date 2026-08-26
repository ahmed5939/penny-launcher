import type { NavItem } from '../../config/navigation'

import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { navSections } from '../../config/navigation'
import { AutomationStatusType } from '../../config/constants/automation'

import { StatusDot } from '../page'

import { useGetAccounts } from '../../hooks/accounts'
import { useGetAutomationDataStatus } from '../../hooks/stw-operations/automation'
import { useGetTaxiServiceDataStatus } from '../../hooks/stw-operations/taxi-service'
import { useCustomizableMenuSettingsVisibility } from '../../hooks/settings'

import { cn } from '../../lib/utils'

/**
 * Navigation rail. Destinations only.
 *
 * The account list that briefly lived up here is gone again — the titlebar
 * picker is the one place accounts are chosen, and two controls for the same
 * scope meant neither could be trusted at a glance. What is left is a plain
 * list of places: no dropdowns, no eyebrow headers shouting in uppercase,
 * one hairline between groups, every item one click.
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
            (item) => !item.can || getMenuOptionVisibility(item.can)
          )

          // A section with no children is itself the destination.
          if (items.length === 0) {
            return section.to ? (
              <NavRow
                key={section.key}
                isActive={pathname === section.to}
                item={{
                  icon: section.icon,
                  label: section.label,
                  to: section.to,
                }}
                label={t(section.label)}
              />
            ) : null
          }

          return (
            <div key={section.key}>
              {/* A hairline is enough to say "new group". */}
              {sectionIndex > 0 && (
                <div className="mx-2 my-1.5 h-px bg-border/60" />
              )}
              {items.map((item) => (
                <NavRow
                  key={`${item.to}-${item.label}`}
                  isActive={pathname.startsWith(item.to)}
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
  item: Pick<NavItem, 'icon' | 'params' | 'to'> & { label: string }
  label: string
  status?: AutomationStatusType | null
}) {
  const Icon = item.icon

  const body = (
    <>
      <Icon className="size-4 shrink-0 opacity-75" />
      <span className="flex-1 truncate">{label}</span>
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
