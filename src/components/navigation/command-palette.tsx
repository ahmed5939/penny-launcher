import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { navSections } from '../../config/navigation'

import { BetaBadge } from './beta-badge'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command'

import { useCustomizableMenuSettingsVisibility } from '../../hooks/settings'

import { useAccountListStore } from '../../state/accounts/list'

/**
 * ⌘K / Ctrl+K jump-to-anything.
 *
 * With the tool list out of permanent view, this is the fast path: type
 * three letters instead of hunting a menu. Reads the same nav description
 * the section menus do, and honours the same visibility settings.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation(['sidebar', 'general'])

  const navigate = useNavigate()
  const accounts = useAccountListStore((state) => state.accounts)
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  const areThereAccounts = Object.keys(accounts).length > 0

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <CommandInput placeholder={t('general:actions.search')} />
      <CommandList>
        <CommandEmpty>{t('general:no-item-found')}</CommandEmpty>

        {navSections.map((section) => {
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
                item.canAny.some((key) => getMenuOptionVisibility(key))) &&
              !(item.needsAccount && !areThereAccounts)
          )

          const sectionDestination =
            items.length === 0 && section.to
              ? [
                  {
                    beta: undefined,
                    icon: section.icon,
                    label: section.label,
                    params: undefined,
                    to: section.to,
                  },
                ]
              : items

          if (sectionDestination.length === 0) {
            return null
          }

          return (
            <CommandGroup
              key={section.key}
              heading={t(section.label)}
            >
              {sectionDestination.map((item) => {
                const Icon = item.icon
                const label =
                  item.label === 'EULA' ? 'EULA' : t(item.label)

                return (
                  <CommandItem
                    className="gap-2"
                    key={`${item.to}-${item.label}`}
                    value={label}
                    onSelect={() => {
                      onOpenChange(false)
                      navigate({
                        to: item.to,
                        params: item.params,
                      })
                    }}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{label}</span>
                    {'beta' in item && item.beta && <BetaBadge />}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}
