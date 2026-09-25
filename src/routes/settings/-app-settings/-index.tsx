import { useTranslation } from 'react-i18next'

import { SettingsSection } from '../-section'
import { AppearanceSettings } from './-appearance'
import { AppSettingsBaseForm } from './-base-form'
import { LanguageSelector } from './-language'

export function AppSettings() {
  const { t } = useTranslation(['settings'])

  return (
    <div className="space-y-5">
      <SettingsSection title={t('app-settings.form.sections.appearance')}>
        <AppearanceSettings />
        <LanguageSelector />
      </SettingsSection>

      <AppSettingsBaseForm />
    </div>
  )
}
