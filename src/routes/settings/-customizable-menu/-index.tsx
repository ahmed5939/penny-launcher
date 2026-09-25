import type { CustomizableMenuSettings } from '../../../types/settings'

import { useTranslation } from 'react-i18next'

import { Panel, PanelHeader } from '../../../components/page'
import { Switch } from '../../../components/ui/switch'

import {
  useCustomizableMenuSettingsActions,
  useCustomizableMenuSettingsVisibility,
} from '../../../hooks/settings'

import { cn } from '../../../lib/utils'

type MenuKey = keyof CustomizableMenuSettings

/** The legacy per-method keys the single "Add account" switch stands in for. */
const addAccountMenuKeys = [
  'authorizationCode',
  'exchangeCode',
  'deviceAuth',
] as const

/**
 * One entry: a sidebar key and its label. `keys` lets one switch drive
 * several stored keys (Add account); `label` is either a `sidebar` i18n key
 * or, where the rail never had a translation, the literal name.
 */
type MenuEntry = {
  id: string
  keys: ReadonlyArray<MenuKey>
  label: string
  literal?: boolean
}

type MenuCategory = {
  entries: ReadonlyArray<MenuEntry>
  id: string
  key: MenuKey
  label: string
}

const entry = (id: string, key: MenuKey, label: string, literal = false): MenuEntry => ({
  id,
  keys: [key],
  label,
  literal,
})

const categories: ReadonlyArray<MenuCategory> = [
  {
    id: 'stw-operations',
    key: 'stwOperations',
    label: 'stw-operations.title',
    entries: [
      entry('menu-currentAlerts', 'currentAlerts', 'missions'),
      // The auto-kick toggle is hidden while the feature is disabled — party
      // kicks no longer work while a match is running.
      entry('expeditions', 'expeditions', 'stw-operations.options.expeditions'),
      entry('squad-presets', 'squadPresets', 'stw-operations.options.squad-presets'),
      entry('inventory', 'inventory', 'stw-operations.options.inventory'),
      entry('codex', 'codex', 'stw-operations.options.codex'),
      entry('loadouts', 'loadouts', 'stw-operations.options.loadouts'),
      entry('quests', 'quests', 'stw-operations.options.quests'),
      entry('timeline', 'timeline', 'stw-operations.options.timeline'),
      entry('shop', 'shop', 'stw-operations.options.shop'),
      entry('xp-boosts', 'xpBoosts', 'stw-operations.options.xp-boosts'),
      entry('auto-pin-urns', 'autoPinUrns', 'stw-operations.options.auto-pin-urns'),
      entry('auto-llamas', 'autoLlamas', 'stw-operations.options.auto-llamas'),
      entry('auto-daily-reroll', 'autoDailyReroll', 'stw-operations.options.auto-daily-reroll'),
      entry('outpost', 'outpost', 'Outpost', true),
    ],
  },
  {
    id: 'account-management',
    key: 'accountManagement',
    label: 'account-management.title',
    entries: [
      entry('vbucks-information', 'vbucksInformation', 'account-management.options.vbucks-information'),
      entry('gifts-information', 'giftsInformation', 'account-management.options.gifts-information'),
      entry('profile', 'profile', 'account-management.options.history'),
      entry('redeem-codes', 'redeemCodes', 'account-management.options.redeem-codes'),
      entry('epic-games-settings', 'epicGamesSettings', 'account-management.options.epic-settings'),
      entry('eula', 'eula', 'EULA', true),
    ],
  },
  {
    id: 'advanced-mode',
    key: 'advancedMode',
    label: 'advanced-mode.title',
    entries: [
      entry('matchmaking-track', 'matchmakingTrack', 'advanced-mode.options.matchmaking-track'),
      entry('server-status', 'serverStatus', 'advanced-mode.options.server-status'),
      entry('world-info', 'worldInfo', 'advanced-mode.options.world-info'),
      entry('game-settings', 'fnLaunch', 'advanced-mode.options.game-settings'),
    ],
  },
  {
    id: 'my-accounts',
    key: 'myAccounts',
    label: 'accounts.title',
    entries: [
      entry('show-total-accounts', 'showTotalAccounts', 'accounts.options.show-total-accounts'),
      /*
        One switch for the unified Add-account page. It drives the three
        legacy per-method keys together, so old saved settings still count.
      */
      { id: 'add-account', keys: addAccountMenuKeys, label: 'Add account', literal: true },
      entry('remove-account', 'removeAccount', 'accounts.options.remove'),
    ],
  },
]

/**
 * The sidebar, section by section: each section's switch in its title strip,
 * its pages as a grid of switches underneath, dimmed while the section is off.
 */
export function CustomizableMenu() {
  const { t } = useTranslation(['settings'])

  return (
    <div className="space-y-5">
      <p className="text-ui text-muted-foreground">
        {t('custom-menu.description')}
      </p>
      {categories.map((category) => (
        <CategoryPanel category={category} key={category.id} />
      ))}
    </div>
  )
}

function CategoryPanel({ category }: { category: MenuCategory }) {
  const { t } = useTranslation(['sidebar'])

  const { getMenuOptionVisibility } = useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  const title = t(category.label)
  const sectionOn = getMenuOptionVisibility(category.key)

  return (
    <Panel>
      <PanelHeader
        actions={
          <Switch
            aria-label={title}
            checked={sectionOn}
            id={category.id}
            onCheckedChange={updateMenuOption(category.key)}
          />
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
        {category.entries.map((item) => {
          const label = item.literal ? item.label : t(item.label)

          return (
            <li
              className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/30"
              key={item.id}
            >
              <label className="min-w-0 flex-1 truncate text-ui" htmlFor={item.id}>
                {label}
              </label>
              <Switch
                checked={item.keys.some((key) => getMenuOptionVisibility(key))}
                id={item.id}
                onCheckedChange={(visibility) => {
                  for (const key of item.keys) {
                    updateMenuOption(key)(visibility)
                  }
                }}
              />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
