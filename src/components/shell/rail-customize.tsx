import type { NavItem, NavSection } from '../../config/navigation'

import { Link } from '@tanstack/react-router'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { navSections, resolveNavLabel, visibilityKeys } from '../../config/navigation'

import { Label } from '../ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover'
import { ScrollArea } from '../ui/scroll-area'
import { Switch } from '../ui/switch'

import { cn } from '../../lib/utils'

import {
  useCustomizableMenuSettingsActions,
  useCustomizableMenuSettingsVisibility,
} from '../../hooks/settings'

/**
 * In-rail customizer for the existing customizable-menu settings.
 *
 * Writes the same keys Settings does, so a hide here survives restart and
 * stays in sync with the Settings page. Hidden destinations remain in ⌘K.
 */
export function RailCustomize() {
  const { t } = useTranslation(['sidebar', 'settings'])

  return (
    <div className="border-t border-border/60 p-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[0.8125rem] text-muted-foreground hover:bg-accent/30 hover:text-foreground"
          >
            <SlidersHorizontal className="size-4 shrink-0 opacity-75" />
            <span className="truncate">{t('sidebar:customize.title')}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="right"
          className="w-64 p-0"
        >
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className="text-[0.8125rem] font-medium">
              {t('sidebar:customize.title')}
            </p>
            <p className="mt-0.5 text-[0.6875rem] leading-snug text-muted-foreground">
              {t('sidebar:customize.description')}
            </p>
          </div>
          <ScrollArea className="h-[min(24rem,70vh)]">
            <div className="space-y-3 p-3">
              {navSections.map((section) => (
                <CustomizeSection
                  key={section.key}
                  section={section}
                />
              ))}
            </div>
          </ScrollArea>
          <div className="border-t border-border/60 px-3 py-2">
            <Link
              to="/settings"
              className="text-[0.6875rem] text-muted-foreground hover:text-foreground"
            >
              {t('sidebar:customize.open-settings')}
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function CustomizeSection({ section }: { section: NavSection }) {
  const { t } = useTranslation(['sidebar'])
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  if (section.items.length === 0) {
    if (!section.can) {
      return null
    }

    return (
      <ToggleRow
        checked={getMenuOptionVisibility(section.can)}
        id={`rail-${section.key}`}
        label={resolveNavLabel(t, section.label)}
        onCheckedChange={updateMenuOption(section.can)}
      />
    )
  }

  return (
    <div>
      {section.can ? (
        <ToggleRow
          checked={getMenuOptionVisibility(section.can)}
          className="mb-1 font-medium"
          id={`rail-section-${section.key}`}
          label={resolveNavLabel(t, section.label)}
          onCheckedChange={updateMenuOption(section.can)}
        />
      ) : (
        <p className="mb-1 text-[0.6875rem] font-medium text-muted-foreground">
          {resolveNavLabel(t, section.label)}
        </p>
      )}
      <div className="space-y-0.5 pl-1">
        {section.items.map((item) => (
          <ItemToggle
            key={`${item.to}-${item.label}`}
            item={item}
          />
        ))}
      </div>
    </div>
  )
}

function ItemToggle({ item }: { item: NavItem }) {
  const { t } = useTranslation(['sidebar'])
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  const keys = visibilityKeys(item)

  if (keys.length === 0) {
    return null
  }

  const checked = keys.some((key) => getMenuOptionVisibility(key))
  const id = `rail-item-${item.to}`

  return (
    <ToggleRow
      checked={checked}
      id={id}
      label={resolveNavLabel(t, item.label)}
      onCheckedChange={(visibility) => {
        for (const key of keys) {
          updateMenuOption(key)(visibility)
        }
      }}
    />
  )
}

function ToggleRow({
  checked,
  className,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean
  className?: string
  id: string
  label: string
  onCheckedChange: (visibility: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <Label
        className={cn(
          'min-w-0 flex-1 cursor-pointer truncate text-[0.75rem] leading-4',
          className,
        )}
        htmlFor={id}
      >
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}
