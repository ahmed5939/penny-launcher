import { useTranslation } from 'react-i18next'

import { colorThemes, defaultColorTheme } from '../../config/constants/color-themes'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover'

import {
  ThemeModeToggle,
  ThemeSwatch,
  ThemeSwatchGrid,
} from '../theme-picker'

import { useTheme } from '../theme-provider'

import { cn } from '../../lib/utils'

/**
 * Titlebar theme picker.
 *
 * The six palettes and the light/dark switch lived only at the bottom of the
 * Settings page, so most people never learned the app had them. The trigger
 * is the live swatch rather than an icon: the chrome carries a dot in the
 * colour you are currently wearing, which is both the control and the hint
 * that it is a control.
 *
 * The flyout is sized like the rail's customizer, not like the Settings
 * panel — a dropdown that hangs twice the height of the window's titlebar
 * reads as a page that got loose, however correct its contents are.
 */
export function ThemeSwitcher() {
  const { t } = useTranslation(['settings'])
  const { colorTheme } = useTheme()

  const active =
    colorThemes.find((current) => current.id === colorTheme) ??
    colorThemes.find((current) => current.id === defaultColorTheme)!

  const label = `${t('app-settings.form.appearance.theme.label')} — ${active.name}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex size-7 items-center justify-center rounded-lg border border-transparent',
            'transition-colors hover:border-primary/40 hover:bg-accent/30',
            'data-[state=open]:border-primary/40 data-[state=open]:bg-accent/30'
          )}
          title={label}
        >
          <ThemeSwatch
            className="size-4"
            gradient={active.gradient}
          />
          <span className="sr-only">{label}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-52 p-1.5"
      >
        <p className="micro-label px-1 pb-1.5">
          {t('app-settings.form.appearance.label')}
        </p>
        {/* `flex-1` on the items so the three modes split the flyout evenly. */}
        <ThemeModeToggle
          className="w-full [&>button]:flex-1"
          showLabels={false}
          size="sm"
        />

        <p className="micro-label px-1 pb-1.5 pt-3">
          {t('app-settings.form.appearance.theme.label')}
        </p>
        <ThemeSwatchGrid variant="menu" />
      </PopoverContent>
    </Popover>
  )
}
