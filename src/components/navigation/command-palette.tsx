import { useNavigate } from '@tanstack/react-router'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { colorThemes } from '../../config/constants/color-themes'
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

import { ThemeSwatch } from '../theme-picker'
import { useTheme } from '../theme-provider'

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

        <AppearanceCommands onDone={() => onOpenChange(false)} />
      </CommandList>
    </CommandDialog>
  )
}

/**
 * Appearance, from the palette.
 *
 * The third way to reach the themes, after the titlebar swatch and the
 * Settings panel — this is the one that answers someone typing “dark”, which
 * is what a person does before they think to go looking for a control.
 */
function AppearanceCommands({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation(['settings'])
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme()

  const modes = [
    { icon: Sun, id: 'light' },
    { icon: Moon, id: 'dark' },
    { icon: Monitor, id: 'system' },
  ] as const

  return (
    <CommandGroup heading={t('app-settings.form.appearance.label')}>
      {modes.map((mode) => {
        const Icon = mode.icon
        const label = t(`app-settings.form.appearance.mode.${mode.id}`)

        return (
          <CommandItem
            className="gap-2"
            key={mode.id}
            value={`${t('app-settings.form.appearance.label')} ${label}`}
            onSelect={() => {
              setTheme(mode.id)
              onDone()
            }}
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">{label}</span>
            {theme === mode.id && (
              <span className="text-[0.625rem] text-muted-foreground">
                Active
              </span>
            )}
          </CommandItem>
        )
      })}

      {colorThemes.map((current) => (
        <CommandItem
          className="gap-2"
          key={current.id}
          value={`${t('app-settings.form.appearance.theme.label')} ${current.name}`}
          onSelect={() => {
            setColorTheme(current.id)
            onDone()
          }}
        >
          <ThemeSwatch
            className="size-4"
            gradient={current.gradient}
          />
          <span className="flex-1">{current.name}</span>
          {colorTheme === current.id && (
            <span className="text-[0.625rem] text-muted-foreground">
              Active
            </span>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
