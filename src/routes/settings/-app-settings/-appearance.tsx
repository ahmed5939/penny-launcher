import type { HomeArt } from '../../../config/backdrops'

import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { FieldRow } from '../../../components/page'
import {
  ThemeModeToggle,
  ThemeSwatchGrid,
} from '../../../components/theme-picker'
import { useTheme } from '../../../components/theme-provider'
import { homeArtOptions, homeBackdrop } from '../../../config/backdrops'
import { cn } from '../../../lib/utils'
import { useBackdropStore } from '../../../state/ui/backdrop'

/**
 * The long form of the theme controls.
 *
 * Same pieces the titlebar picker draws — this page adds the labels and the
 * room to read them, but is no longer the only way to find the palettes.
 */
export function AppearanceSettings() {
  const { t } = useTranslation(['settings'])

  return (
    <>
      <FieldRow
        hint={t('app-settings.form.appearance.note')}
        label={t('app-settings.form.appearance.label')}
      >
        <ThemeModeToggle size="sm" />
      </FieldRow>
      <FieldRow
        hint={t('app-settings.form.appearance.theme.note')}
        label={t('app-settings.form.appearance.theme.label')}
        stacked
      >
        <ThemeSwatchGrid className="pt-1 lg:grid-cols-3" />
      </FieldRow>
      <FieldRow
        hint="The picture behind Home's Play button. Colour theme shows the zone your theme is named after."
        label="Home art"
        stacked
      >
        <HomeArtPicker />
      </FieldRow>
    </>
  )
}

function HomeArtPicker() {
  const { colorTheme } = useTheme()
  const homeArt = useBackdropStore((state) => state.homeArt)
  const setHomeArt = useBackdropStore((state) => state.setHomeArt)

  const options: Array<{ id: HomeArt | 'theme'; label: string; src: string; position: string }> = [
    { id: 'theme', label: 'Colour theme', ...homeBackdrop(colorTheme, 'theme') },
    ...Object.entries(homeArtOptions).map(([id, option]) => ({
      id: id as HomeArt,
      label: option.label,
      ...option.backdrop,
    })),
  ]

  return (
    <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3 lg:grid-cols-4">
      {options.map((option) => {
        const isActive = homeArt === option.id

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              'group relative aspect-[16/7] overflow-hidden rounded-xl ring-1 ring-inset ring-border transition-shadow',
              'hover:ring-foreground/40',
              isActive && 'ring-2 ring-primary hover:ring-primary'
            )}
            key={option.id}
            onClick={() => setHomeArt(option.id)}
            type="button"
          >
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              decoding="async"
              loading="lazy"
              src={option.src}
              style={{ objectPosition: option.position }}
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5 text-left text-caption font-medium text-white">
              <span className="truncate">{option.label}</span>
              {isActive && <Check className="ml-auto size-3.5 shrink-0" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
