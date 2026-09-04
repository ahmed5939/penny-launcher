import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  activeSectionFor,
  matchesNavPath,
  navSections,
  sectionLanding,
  visibleSectionItems,
} from '../../config/navigation'
import { useGetTaxiServiceDataStatus } from '../../hooks/stw-operations/taxi-service'
import { AutomationStatusType } from '../../config/constants/automation'
import { StatusDot } from '../page/stat'
import { useGetAccounts } from '../../hooks/accounts'
import { useCustomizableMenuSettingsVisibility } from '../../hooks/settings'
import { useMediaQuery } from '../../hooks/ui/media-query'
import { useShellStore } from '../../state/ui/shell'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { AreaItems, AreaPane } from './area-pane'
import { RailCustomize } from './rail-customize'
import { cn } from '../../lib/utils'

/** Expanded areas restore the last usable page. Collapsed areas expose a menu.
 * Merely opening a menu never changes the current route. */
export function AreaNavigation() {
  const { t } = useTranslation(['sidebar', 'general'])
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigate = useNavigate()
  const compact = useMediaQuery('(max-width: 1100px)')
  const { paneCollapsed, togglePane, lastPaths, rememberPath } = useShellStore()
  const collapsed = compact || paneCollapsed
  const [openArea, setOpenArea] = useState<string | null>(null)
  const active = activeSectionFor(pathname)
  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()
  const { accountsArray } = useGetAccounts()
  const hasAccount = accountsArray.some(
    (account) => account.authStatus !== 'invalid',
  )
  const { status: taxiStatus } = useGetTaxiServiceDataStatus()
  const railRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (active) rememberPath(active.key, pathname)
    setOpenArea(null)
  }, [active, pathname, collapsed, rememberPath])

  // On narrow windows Ctrl+B opens the current area's menu; the saved pane
  // preference takes effect when there is enough space for a docked pane.
  const previousCollapsed = useRef(paneCollapsed)
  useEffect(() => {
    const changed = previousCollapsed.current !== paneCollapsed
    previousCollapsed.current = paneCollapsed
    if (compact && changed && active && active.items.length > 0) {
      setOpenArea((current) => (current === active.key ? null : active.key))
    }
  }, [paneCollapsed, compact, active])

  // A hidden destination reached from the palette keeps its area and current
  // row visible until the user leaves, so the shell can still orient them.
  const itemsFor = (section: (typeof navSections)[number]) => {
    const items = visibleSectionItems(section, getMenuOptionVisibility)
    const current = section.items.find((item) =>
      matchesNavPath(pathname, item.to),
    )
    return current && !items.includes(current) ? [...items, current] : items
  }
  const buttonClass =
    'relative flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const collapsePane = () => {
    const pane = document.querySelector('[data-app-focus-region="pane"]')
    if (pane?.contains(document.activeElement)) {
      railRef.current
        ?.querySelector<HTMLButtonElement>('[data-pane-toggle]')
        ?.focus()
    }
    togglePane()
  }

  return (
    <>
      <aside
        ref={railRef}
        className="chrome-surface flex w-14 shrink-0 flex-col border-r border-border/60"
        data-app-focus-region="rail"
        tabIndex={-1}
        aria-label={t('navigation')}
      >
        <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
          {navSections.map((section) => {
            const visible = visibleSectionItems(
              section,
              getMenuOptionVisibility,
            )
            if (
              active !== section &&
              ((section.can && !getMenuOptionVisibility(section.can)) ||
                (section.items.length > 0 &&
                  visible.length === 0 &&
                  !section.to))
            )
              return null
            const items = itemsFor(section)
            // An explicit child landing does not keep an otherwise empty area visible.
            if (
              active !== section &&
              section.items.length > 0 &&
              items.length === 0 &&
              section.items.some((item) => item.to === section.to)
            )
              return null
            const destination = sectionLanding(
              section,
              visible,
              hasAccount,
              lastPaths[section.key],
            )
            const Icon = section.icon
            const isActive = active === section
            const flyout = collapsed && section.items.length > 0
            return (
              <Popover
                key={section.key}
                open={openArea === section.key}
                onOpenChange={(open) => setOpenArea(open ? section.key : null)}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={t(section.label)}
                        aria-current={isActive ? 'true' : undefined}
                        aria-haspopup={flyout ? 'dialog' : undefined}
                        aria-expanded={
                          flyout ? openArea === section.key : undefined
                        }
                        className={cn(
                          buttonClass,
                          isActive && 'bg-accent/60 text-foreground',
                        )}
                        onClick={(event) => {
                          if (flyout) return
                          event.preventDefault()
                          if (!isActive && destination)
                            void navigate(destination)
                        }}
                      >
                        <Icon className="size-5" />
                        {section.key === 'automate' && taxiStatus && (
                          <span
                            className="absolute right-1 top-1"
                            title={taxiStatus}
                          >
                            <StatusDot
                              tone={
                                taxiStatus === AutomationStatusType.ISSUE
                                  ? 'warning'
                                  : 'active'
                              }
                            />
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-primary" />
                        )}
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {t(section.label)}
                  </TooltipContent>
                </Tooltip>
                {flyout && (
                  <PopoverContent
                    side="right"
                    align="start"
                    className="max-h-[80vh] w-60 overflow-y-auto p-2"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('a[href]'))
                        setOpenArea(null)
                    }}
                  >
                    <p className="micro-label px-2 pb-2 pt-1">
                      {t(section.label)}
                    </p>
                    {section.to &&
                      !section.items.some((item) => item.to === section.to) && (
                        <Link
                          className="mb-2 block rounded-lg px-2 py-2 text-sm hover:bg-accent/40"
                          to={section.to}
                        >
                          {t(section.label)}
                        </Link>
                      )}
                    <AreaItems items={items} pathname={pathname} />
                    {items.length === 0 && (
                      <p className="p-2 text-xs text-muted-foreground">
                        {t('no-tools')}
                      </p>
                    )}
                  </PopoverContent>
                )}
              </Popover>
            )
          })}
        </nav>
        <div className="flex shrink-0 flex-col items-center gap-1 border-t border-border/60 py-2">
          <RailCustomize compact />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                aria-label={t('general:settings')}
                aria-current={
                  matchesNavPath(pathname, '/settings') ? 'page' : undefined
                }
                className={cn(
                  buttonClass,
                  matchesNavPath(pathname, '/settings') &&
                    'bg-accent/60 text-foreground',
                )}
              >
                <Settings className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t('general:settings')}
            </TooltipContent>
          </Tooltip>
          {!compact && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-pane-toggle
                  aria-label={t('toggle-pane')}
                  aria-expanded={!collapsed}
                  className={buttonClass}
                  onClick={collapsePane}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="size-5" />
                  ) : (
                    <PanelLeftClose className="size-5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t('toggle-pane')} (Ctrl+B)
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
      {active && active.items.length > 0 && !collapsed && (
        <AreaPane
          section={active}
          items={itemsFor(active)}
          pathname={pathname}
        />
      )}
    </>
  )
}
