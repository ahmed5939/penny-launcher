import { Panel, PanelBody } from '../../../components/page'
import { Separator } from '../../../components/ui/separator'
import { AppSettingsBaseForm } from './-base-form'
import { LanguageSelector } from './-language'

export function AppSettings() {
  return (
    <Panel>
      <PanelBody className="grid">
        <LanguageSelector />

        <Separator className="my-6" />

        <AppSettingsBaseForm />
      </PanelBody>
    </Panel>
  )
}
