import { Panel, PanelBody } from '../../../components/page'
import { Separator } from '../../../components/ui/separator'
import { AppearanceSettings } from './-appearance'
import { AppSettingsBaseForm } from './-base-form'
import { LanguageSelector } from './-language'

export function AppSettings() {
  return (
    <Panel>
      <PanelBody className="grid">
        <AppearanceSettings />

        <Separator className="my-6" />

        <LanguageSelector />

        <Separator className="my-6" />

        <AppSettingsBaseForm />
      </PanelBody>
    </Panel>
  )
}
