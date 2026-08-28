import type { LucideIcon } from 'lucide-react'

import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { colorThemes } from '../config/constants/color-themes'

import {
  ToggleGroup,
  ToggleGroupItem,
} from './ui/toggle-group'

import { type Theme, useTheme } from './theme-provider'

import { cn } from '../lib/utils'

/**
 * The theme controls, as pieces.
 *
 * These used to be written inline in the Settings appearance panel, which is
 * the one place in the app a person only visits on purpose — the six palettes
 * were effectively undiscoverable. They now live here so the titlebar picker
 * and the Settings panel render the same controls from one definition instead
 * of the second copy drifting from the first.
 *
 * Labels come from the `settings` namespace either way, so the strings stay
 * translated in every locale that already had them.
 */

const themeModes: ReadonlyArray<{ icon: LucideIcon; id: Theme }> = [
  { icon: Sun, id: 'light' },
  { icon: Moon, id: 'dark' },
  { icon: Monitor, id: 'system' },
]

/**
 * Light / dark / system.
 *
 * `showLabels` off drops to the three icons, which is what fits a titlebar
 * flyout: spelled out, the widest of the three labels alone is wider than an
 * even third of the popover, so the row either overflows or truncates the one
 * word that distinguishes it. The names survive as the accessible name and
 * the tooltip.
 */
export function ThemeModeToggle({
  className,
  showLabels = true,
  size = 'default',
}: {
  className?: string
  showLabels?: boolean
  size?: 'default' | 'sm' | 'xs'
}) {
  const { t } = useTranslation(['settings'])
  const { theme, setTheme } = useTheme()

  return (
    <ToggleGroup
      className={cn('justify-start', className)}
      type="single"
      variant="outline"
      size={size}
      value={theme}
      onValueChange={(value) => {
        /* Radix reports a re-click of the active item as ''; keep the current mode. */
        if (value) {
          setTheme(value as Theme)
        }
      }}
    >
      {themeModes.map((mode) => {
        const Icon = mode.icon
        const label = t(`app-settings.form.appearance.mode.${mode.id}`)

        return (
          <ToggleGroupItem
            key={mode.id}
            value={mode.id}
            title={showLabels ? undefined : label}
          >
            <Icon className={size === 'xs' ? 'size-3.5' : 'size-4'} />
            {showLabels ? label : <span className="sr-only">{label}</span>}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

/**
 * The gradient dot for one palette.
 *
 * Paints from the catalogue's `gradient` triple, which mirrors that theme's
 * `--brand-*`, so a swatch previews the real palette without mounting it.
 */
export function ThemeSwatch({
  className,
  gradient,
}: {
  className?: string
  gradient: readonly [string, string, string] | ReadonlyArray<string>
}) {
  const [from, via, to] = gradient

  return (
    <span
      aria-hidden
      className={cn(
        'size-5 shrink-0 rounded-full border border-border/60',
        className
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${from}), hsl(${via}) 55%, hsl(${to}))`,
      }}
    />
  )
}

/**
 * The palette list.
 *
 * Two presentations of one list. `cards` is the Settings page: a grid with
 * room to breathe, on a page you came to on purpose. `menu` is the titlebar
 * popover, where the same six entries have to read as menu rows — six
 * bordered cards stacked inside a dropdown look like a settings page that
 * escaped into the chrome, and stand roughly twice as tall as the titlebar
 * they hang off.
 */
export function ThemeSwatchGrid({
  className,
  variant = 'cards',
}: {
  className?: string
  variant?: 'cards' | 'menu'
}) {
  const { colorTheme, setColorTheme } = useTheme()

  const isMenu = variant === 'menu'

  return (
    <div
      className={cn(
        isMenu ? 'flex flex-col' : 'grid grid-cols-2 gap-2 sm:grid-cols-3',
        className
      )}
    >
      {colorThemes.map((current) => {
        const isActive = colorTheme === current.id

        return (
          <button
            type="button"
            aria-pressed={isActive}
            className={cn(
              isMenu
                ? [
                    'flex h-8 items-center gap-2.5 rounded-lg px-2 text-[0.8125rem]',
                    'text-muted-foreground transition-colors',
                    'hover:bg-accent/30 hover:text-foreground',
                    isActive && 'bg-accent/25 text-foreground',
                  ]
                : [
                    'panel-interactive flex items-center gap-2.5 px-3 py-2 text-sm',
                    isActive && 'border-primary/60 bg-accent/40',
                  ]
            )}
            onClick={() => setColorTheme(current.id)}
            key={current.id}
          >
            <ThemeSwatch
              className={isMenu ? 'size-3.5' : undefined}
              gradient={current.gradient}
            />
            <span className="truncate">{current.name}</span>
            {isActive && (
              <Check
                className={cn(
                  'ml-auto shrink-0 text-primary',
                  isMenu ? 'size-3.5' : 'size-4'
                )}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
