import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { navSections, resolveNavLabel, visibilityKeys } from '../../config/navigation'

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
 * Reads the same nav description the rail does. Sidebar visibility is
 * ignored here on purpose: hiding a tool from the rail must not make it
 * unreachable — type three letters instead.
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
          const items = section.items.filter(
            (item) => !(item.needsAccount && !areThereAccounts)
          )

          const destinations =
            items.length === 0 && section.to
              ? [
                  {
                    beta: false,
                    can: section.can,
                    icon: section.icon,
                    label: section.label,
                    params: undefined as Record<string, string> | undefined,
                    to: section.to,
                  },
                ]
              : items

          if (destinations.length === 0) {
            return null
          }

          return (
            <CommandGroup
              key={section.key}
              heading={resolveNavLabel(t, section.label)}
            >
              {destinations.map((item) => {
                const Icon = item.icon
                const label = resolveNavLabel(t, item.label)
                const keys = visibilityKeys(item)
                const hidden =
                  keys.length > 0 &&
                  !keys.some((key) => getMenuOptionVisibility(key))

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
                    {hidden && (
                      <span className="text-[0.625rem] text-muted-foreground">
                        Hidden
                      </span>
                    )}
                    {item.beta && <BetaBadge />}
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
