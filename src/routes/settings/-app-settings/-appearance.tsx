import { useTranslation } from 'react-i18next'

import { FieldRow } from '../../../components/page'
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
    </>
  )
}
