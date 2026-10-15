import type { CustomizeRow, MenuKey, NavSection } from '../../../config/navigation'

import { useTranslation } from 'react-i18next'

import { customizeRows, navSections } from '../../../config/navigation'
import { Panel, PanelHeader } from '../../../components/page'
import { Switch } from '../../../components/ui/switch'

import {
  useCustomizableMenuSettingsActions,
  useCustomizableMenuSettingsVisibility,
} from '../../../hooks/settings'

import { cn } from '../../../lib/utils'

/**
 * The sidebar as the rail shows it: the same sections in the same order, one
 * switch per row. Save the World and automations share one switch, so it gets
 * a strip of its own above both sections.
 */
export function CustomizableMenu() {
  const { t } = useTranslation(['settings', 'sidebar'])

  return (
    <div className="space-y-5">
      <p className="text-ui text-muted-foreground">
        {t('custom-menu.description')}
      </p>
      <SwitchPanel
        id="menu-stw-and-automations"
        label={t('sidebar:stw-and-automations')}
        menuKey="stwOperations"
      />
      {navSections
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <SectionPanel key={section.key} section={section} />
        ))}
      <SwitchPanel
        id="menu-show-total-accounts"
        label={t('sidebar:accounts.options.show-total-accounts')}
        menuKey="showTotalAccounts"
      />
    </div>
  )
}

function SectionPanel({ section }: { section: NavSection }) {
  const { t } = useTranslation(['sidebar'])
  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  const { can } = section
  const title = t(section.label)
  const sectionOn = !can || getMenuOptionVisibility(can)

  return (
    <Panel>
      <PanelHeader
        actions={
          can && can !== 'stwOperations' ? (
            <Switch
              aria-label={title}
              checked={sectionOn}
              id={`menu-section-${section.key}`}
              onCheckedChange={updateMenuOption(can)}
            />
          ) : undefined
        }
        compact
        title={title}
      />
      <ul
        className={cn(
          'grid gap-x-6 px-5 py-3 sm:grid-cols-2 lg:grid-cols-3',
          !sectionOn && 'opacity-50'
        )}
      >
        {customizeRows(section).map((row) => (
          <RowItem key={row.items[0].to} row={row} />
        ))}
      </ul>
    </Panel>
  )
}

function RowItem({ row }: { row: CustomizeRow }) {
  const { t } = useTranslation(['sidebar'])
  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  const id = `menu-${row.items[0].to}`
  const label = row.items.map((item) => t(item.label)).join(', ')

  return (
    <li className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/30">
      <label
        className="min-w-0 flex-1 truncate text-ui"
        htmlFor={id}
        title={label}
      >
        {label}
      </label>
      <Switch
        checked={row.keys.some((key) => getMenuOptionVisibility(key))}
        id={id}
        onCheckedChange={(visibility) => {
          for (const key of row.keys) {
            updateMenuOption(key)(visibility)
          }
        }}
      />
    </li>
  )
}

function SwitchPanel({
  id,
  label,
  menuKey,
}: {
  id: string
  label: string
  menuKey: MenuKey
}) {
  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  return (
    <Panel>
      <PanelHeader
        actions={
          <Switch
            aria-label={label}
            checked={getMenuOptionVisibility(menuKey)}
            id={id}
            onCheckedChange={updateMenuOption(menuKey)}
          />
        }
        compact
        title={label}
      />
    </Panel>
  )
}
