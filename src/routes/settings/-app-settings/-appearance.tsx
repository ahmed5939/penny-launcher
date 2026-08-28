import { useTranslation } from 'react-i18next'

import { Label } from '../../../components/ui/label'

import {
  ThemeModeToggle,
  ThemeSwatchGrid,
} from '../../../components/theme-picker'

/**
 * The long form of the theme controls.
 *
 * Same pieces the titlebar picker draws — this page adds the labels and the
 * room to read them, but is no longer the only way to find the palettes.
 */
export function AppearanceSettings() {
  const { t } = useTranslation(['settings'])

  return (
    <div>
      <Label>{t('app-settings.form.appearance.label')}</Label>
      <ThemeModeToggle className="mt-2" />

      <div className="mt-6">
        <Label>{t('app-settings.form.appearance.theme.label')}</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('app-settings.form.appearance.theme.note')}
        </p>
        <ThemeSwatchGrid className="mt-3" />
      </div>
    </div>
  )
}
