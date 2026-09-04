import type { NavItem, NavSection } from '../../config/navigation'
import { useLayoutEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { matchesNavPath, visibilityKeys } from '../../config/navigation'
import { useGetAccounts } from '../../hooks/accounts'
import { useGetAutomationDataStatus } from '../../hooks/stw-operations/automation'
import { useGetTaxiServiceDataStatus } from '../../hooks/stw-operations/taxi-service'
import { NavRow } from './nav-row'

export function AreaItems({
  items,
  pathname,
}: {
  items: Array<NavItem>
  pathname: string
}) {
  const { t } = useTranslation(['sidebar'])
  const { accountsArray } = useGetAccounts()
  const hasAccount = accountsArray.some(
    (account) => account.authStatus !== 'invalid',
  )
  const { status: autoKick } = useGetAutomationDataStatus()
  const { status: taxi } = useGetTaxiServiceDataStatus()
  const statuses = { 'auto-kick': autoKick, 'taxi-service': taxi }

  return (
    <>
      {[false, true].map((secondary) => {
        const group = items.filter(
          (item) => Boolean(item.secondary) === secondary,
        )
        if (group.length === 0) return null
        return (
          <div
            key={String(secondary)}
            className={
              secondary ? 'mt-3 border-t border-border/60 pt-3' : undefined
            }
          >
            {group.map((item) => (
              <NavRow
                key={item.to}
                item={item}
                label={t(item.label)}
                hideKeys={visibilityKeys(item)}
                isActive={matchesNavPath(pathname, item.to)}
                isDisabled={item.needsAccount && !hasAccount}
                status={item.status ? statuses[item.status] : null}
              />
            ))}
          </div>
        )
      })}
    </>
  )
}

export function AreaPane({
  section,
  items,
  pathname,
}: {
  section: NavSection
  items: Array<NavItem>
  pathname: string
}) {
  const { t } = useTranslation(['sidebar'])
  const paneRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const pane = paneRef.current
    return () => {
      if (pane?.contains(document.activeElement)) {
        document
          .querySelector<HTMLElement>(
            '[data-app-focus-region="rail"] [aria-current]',
          )
          ?.focus()
      }
    }
  }, [])
  return (
    <aside
      ref={paneRef}
      className="chrome-surface flex w-52 shrink-0 flex-col border-r border-border/60"
      data-app-focus-region="pane"
      tabIndex={-1}
      aria-label={t(section.label)}
    >
      <p className="micro-label px-4 pb-2 pt-4">{t(section.label)}</p>
      <nav
        className="min-h-0 flex-1 overflow-y-auto p-2"
        aria-label={t(section.label)}
      >
        {section.to &&
          !section.items.some((item) => item.to === section.to) && (
            <Link
              to={section.to}
              className="mb-2 block rounded-lg px-2 py-2 text-sm hover:bg-accent/40"
              aria-current={pathname === section.to ? 'page' : undefined}
            >
              {t(section.label)}
            </Link>
          )}
        <AreaItems items={items} pathname={pathname} />
        {items.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">{t('no-tools')}</p>
        )}
      </nav>
    </aside>
  )
}
