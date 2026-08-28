import { useTranslation } from 'react-i18next'

import { Panel, PanelBody } from '../../../components/page'
import { Label } from '../../../components/ui/label'
import { Switch } from '../../../components/ui/switch'

import {
  useCustomizableMenuSettingsActions,
  useCustomizableMenuSettingsVisibility,
} from '../../../hooks/settings'

import { cn } from '../../../lib/utils'

/** The legacy per-method keys the single "Add account" switch stands in for. */
const addAccountMenuKeys = [
  'authorizationCode',
  'exchangeCode',
  'deviceAuth',
] as const

export function CustomizableMenu() {
  const { t } = useTranslation(['settings'])

  return (
    <Panel>
      {/* The accordion trigger already names this section. */}
      <div className="border-b border-border/60 px-5 py-3.5">
        <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
          {t('custom-menu.description')}
        </p>
      </div>
      <PanelBody
        className={cn(
          'space-y-4',
          '[&_.category:not(:last-child)]:border-b [&_.category:not(:last-child)]:border-border/50 [&_.category:not(:last-child)]:pb-4',
          '[&_.list]:gap-x-6 [&_.list]:gap-y-1 [&_.list]:grid [&_.list]:grid-cols-2',
          '[&_.title]:flex-1 [&_.title]:cursor-pointer [&_.title]:leading-4',
          '[&_.item]:flex [&_.item]:items-center [&_.item]:justify-between [&_.item]:py-1 [&_.item.main]:mb-2'
        )}
      >
        <CurrentAlertsSection />
        <STWOperationsSection />
        <AccountManagementSection />
        <AdvancedModeSection />
        <MyAccountsSection />
      </PanelBody>
    </Panel>
  )
}

function CurrentAlertsSection() {
  // const { t } = useTranslation(['sidebar'])

  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  return (
    <div className="category">
      <div className="item main">
        <Label
          className="title text-lg"
          htmlFor="current-alerts"
        >
          Current Alerts
        </Label>
        <Switch
          id="current-alerts"
          checked={getMenuOptionVisibility('currentAlerts')}
          onCheckedChange={updateMenuOption('currentAlerts')}
        />
      </div>
    </div>
  )
}

function STWOperationsSection() {
  const { t } = useTranslation(['sidebar'])

  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  return (
    <div className="category">
      <div className="item main">
        <Label
          className="title text-lg"
          htmlFor="stw-operations"
        >
          {t('stw-operations.title')}
        </Label>
        <Switch
          id="stw-operations"
          checked={getMenuOptionVisibility('stwOperations')}
          onCheckedChange={updateMenuOption('stwOperations')}
        />
      </div>
      <div className="list">
        <div className="item">
          <Label
            className="title"
            htmlFor="auto-kick"
          >
            {t('stw-operations.options.auto-kick')}
          </Label>
          <Switch
            id="auto-kick"
            checked={getMenuOptionVisibility('autoKick')}
            onCheckedChange={updateMenuOption('autoKick')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="taxi-service"
          >
            Taxi Service
          </Label>
          <Switch
            id="taxi-service"
            checked={getMenuOptionVisibility('taxiService')}
            onCheckedChange={updateMenuOption('taxiService')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="party"
          >
            {t('stw-operations.options.party')}
          </Label>
          <Switch
            id="party"
            checked={getMenuOptionVisibility('party')}
            onCheckedChange={updateMenuOption('party')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="expeditions"
          >
            {t('stw-operations.options.expeditions')}
          </Label>
          <Switch
            id="expeditions"
            checked={getMenuOptionVisibility('expeditions')}
            onCheckedChange={updateMenuOption('expeditions')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="squad-presets"
          >
            {t('stw-operations.options.squad-presets')}
          </Label>
          <Switch
            id="squad-presets"
            checked={getMenuOptionVisibility('squadPresets')}
            onCheckedChange={updateMenuOption('squadPresets')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="inventory"
          >
            {t('stw-operations.options.inventory')}
          </Label>
          <Switch
            id="inventory"
            checked={getMenuOptionVisibility('inventory')}
            onCheckedChange={updateMenuOption('inventory')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="compendium"
          >
            {t('stw-operations.options.compendium')}
          </Label>
          <Switch
            id="compendium"
            checked={getMenuOptionVisibility('compendium')}
            onCheckedChange={updateMenuOption('compendium')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="loadouts"
          >
            {t('stw-operations.options.loadouts')}
          </Label>
          <Switch
            id="loadouts"
            checked={getMenuOptionVisibility('loadouts')}
            onCheckedChange={updateMenuOption('loadouts')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="quests"
          >
            {t('stw-operations.options.quests')}
          </Label>
          <Switch
            id="quests"
            checked={getMenuOptionVisibility('quests')}
            onCheckedChange={updateMenuOption('quests')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="timeline"
          >
            {t('stw-operations.options.timeline')}
          </Label>
          <Switch
            id="timeline"
            checked={getMenuOptionVisibility('timeline')}
            onCheckedChange={updateMenuOption('timeline')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="shop"
          >
            {t('stw-operations.options.shop')}
          </Label>
          <Switch
            id="shop"
            checked={getMenuOptionVisibility('shop')}
            onCheckedChange={updateMenuOption('shop')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="xp-boosts"
          >
            {t('stw-operations.options.xp-boosts')}
          </Label>
          <Switch
            id="xp-boosts"
            checked={getMenuOptionVisibility('xpBoosts')}
            onCheckedChange={updateMenuOption('xpBoosts')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="auto-pin-urns"
          >
            {t('stw-operations.options.auto-pin-urns')}
          </Label>
          <Switch
            id="auto-pin-urns"
            checked={getMenuOptionVisibility('autoPinUrns')}
            onCheckedChange={updateMenuOption('autoPinUrns')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="auto-llamas"
          >
            {t('stw-operations.options.auto-llamas')}
          </Label>
          <Switch
            id="auto-llamas"
            checked={getMenuOptionVisibility('autoLlamas')}
            onCheckedChange={updateMenuOption('autoLlamas')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="endurance"
          >
            {t('stw-operations.options.endurance')}
          </Label>
          <Switch
            id="endurance"
            checked={getMenuOptionVisibility('endurance')}
            onCheckedChange={updateMenuOption('endurance')}
          />
        </div>
      </div>
    </div>
  )
}

function AccountManagementSection() {
  const { t } = useTranslation(['sidebar'])

  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  return (
    <div className="category">
      <div className="item main">
        <Label
          className="title text-lg"
          htmlFor="account-management"
        >
          {t('account-management.title')}
        </Label>
        <Switch
          id="account-management"
          checked={getMenuOptionVisibility('accountManagement')}
          onCheckedChange={updateMenuOption('accountManagement')}
        />
      </div>
      <div className="list">
        <div className="item">
          <Label
            className="title"
            htmlFor="vbucks-information"
          >
            {t('account-management.options.vbucks-information')}
          </Label>
          <Switch
            id="vbucks-information"
            checked={getMenuOptionVisibility('vbucksInformation')}
            onCheckedChange={updateMenuOption('vbucksInformation')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="profile"
          >
            {t('account-management.options.profile')}
          </Label>
          <Switch
            id="profile"
            checked={getMenuOptionVisibility('profile')}
            onCheckedChange={updateMenuOption('profile')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="redeem-codes"
          >
            {t('account-management.options.redeem-codes')}
          </Label>
          <Switch
            id="redeem-codes"
            checked={getMenuOptionVisibility('redeemCodes')}
            onCheckedChange={updateMenuOption('redeemCodes')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="devices-auth"
          >
            {t('account-management.options.devices-auth')}
          </Label>
          <Switch
            id="devices-auth"
            checked={getMenuOptionVisibility('devicesAuth')}
            onCheckedChange={updateMenuOption('devicesAuth')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="epic-games-settings"
          >
            {t('account-management.options.epic-settings')}
          </Label>
          <Switch
            id="epic-games-settings"
            checked={getMenuOptionVisibility('epicGamesSettings')}
            onCheckedChange={updateMenuOption('epicGamesSettings')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="eula"
          >
            EULA
          </Label>
          <Switch
            id="eula"
            checked={getMenuOptionVisibility('eula')}
            onCheckedChange={updateMenuOption('eula')}
          />
        </div>
      </div>
    </div>
  )
}

function AdvancedModeSection() {
  const { t } = useTranslation(['sidebar'])

  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  return (
    <div className="category">
      <div className="item main">
        <Label
          className="title text-lg"
          htmlFor="advanced-mode"
        >
          {t('advanced-mode.title')}
        </Label>
        <Switch
          id="advanced-mode"
          checked={getMenuOptionVisibility('advancedMode')}
          onCheckedChange={updateMenuOption('advancedMode')}
        />
      </div>
      <div className="list">
        <div className="item">
          <Label
            className="title"
            htmlFor="matchmaking-track"
          >
            {t('advanced-mode.options.matchmaking-track')}
          </Label>
          <Switch
            id="matchmaking-track"
            checked={getMenuOptionVisibility('matchmakingTrack')}
            onCheckedChange={updateMenuOption('matchmakingTrack')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="server-status"
          >
            {t('advanced-mode.options.server-status')}
          </Label>
          <Switch
            id="server-status"
            checked={getMenuOptionVisibility('serverStatus')}
            onCheckedChange={updateMenuOption('serverStatus')}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="world-info"
          >
            {t('advanced-mode.options.world-info')}
          </Label>
          <Switch
            id="world-info"
            checked={getMenuOptionVisibility('worldInfo')}
            onCheckedChange={updateMenuOption('worldInfo')}
          />
        </div>
      </div>
    </div>
  )
}

function MyAccountsSection() {
  const { t } = useTranslation(['sidebar'])

  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()
  const { updateMenuOption } = useCustomizableMenuSettingsActions()

  return (
    <div className="category">
      <div className="item main">
        <Label
          className="title text-lg"
          htmlFor="my-accounts"
        >
          {t('accounts.title')}
        </Label>
        <Switch
          id="my-accounts"
          checked={getMenuOptionVisibility('myAccounts')}
          onCheckedChange={updateMenuOption('myAccounts')}
        />
      </div>
      <div className="list">
        <div className="item mb-1">
          <Label
            className="title"
            htmlFor="show-total-accounts"
          >
            {t('accounts.options.show-total-accounts')}
          </Label>
          <Switch
            id="show-total-accounts"
            checked={getMenuOptionVisibility('showTotalAccounts')}
            onCheckedChange={updateMenuOption('showTotalAccounts')}
          />
        </div>
      </div>
      <div className="list">
        {/*
          One switch for the unified Add-account page. It drives the three
          legacy per-method keys together, so old saved settings still count.
        */}
        <div className="item">
          <Label
            className="title"
            htmlFor="add-account"
          >
            Add account
          </Label>
          <Switch
            id="add-account"
            checked={addAccountMenuKeys.some((key) =>
              getMenuOptionVisibility(key)
            )}
            onCheckedChange={(visibility) => {
              for (const key of addAccountMenuKeys) {
                updateMenuOption(key)(visibility)
              }
            }}
          />
        </div>
        <div className="item">
          <Label
            className="title"
            htmlFor="remove-account"
          >
            {t('accounts.options.remove')}
          </Label>
          <Switch
            id="remove-account"
            checked={getMenuOptionVisibility('removeAccount')}
            onCheckedChange={updateMenuOption('removeAccount')}
          />
        </div>
      </div>
    </div>
  )
}
