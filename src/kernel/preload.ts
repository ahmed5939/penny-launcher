// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge } from 'electron'

import * as accountHealthActions from './preload-actions/account-health'
import * as accountsActions from './preload-actions/accounts'
import * as alertsActions from './preload-actions/alerts'
import * as authenticationActions from './preload-actions/authentication'
import * as autoLlamasActions from './preload-actions/auto-llamas'
import * as autoPinUrnsActions from './preload-actions/auto-pin-urns'
import * as automationsActions from './preload-actions/automation'
import * as customizableMenuActions from './preload-actions/customizable-menu'
import * as devicesAuthActions from './preload-actions/devices-auth'
import * as enduranceActions from './preload-actions/endurance'
import * as eventActions from './preload-actions/events'
import * as expeditionsActions from './preload-actions/expeditions'
import * as friendsManagerActions from './preload-actions/friends-manager'
import * as gameInstallActions from './preload-actions/game-install'
import * as generalActions from './preload-actions/general'
import * as shellActions from './preload-actions/shell'
import * as inventoryActions from './preload-actions/inventory'
import * as itemActionsActions from './preload-actions/item-actions'
import * as itemDatabaseActions from './preload-actions/item-database'
import * as launcherActions from './preload-actions/launcher'
import * as loadoutsActions from './preload-actions/loadouts'
import * as matchmakingActions from './preload-actions/matchmaking'
import * as mcpActions from './preload-actions/mcp'
import * as partyActions from './preload-actions/party'
import * as pluginsActions from './preload-actions/plugins'
import * as questsActions from './preload-actions/quests'
import * as redeemCodesActions from './preload-actions/redeem-codes'
import * as requestActions from './preload-actions/requests'
import * as scheduleActions from './preload-actions/schedules'
import * as serverStatusActions from './preload-actions/server-status'
import * as settingsActions from './preload-actions/settings'
import * as shopActions from './preload-actions/shop'
import * as squadsActions from './preload-actions/squads'
import * as taxiservicesActions from './preload-actions/taxi-service'
import * as timelineActions from './preload-actions/timeline'
import * as vbucksInformationActions from './preload-actions/vbucks-information'
import * as xpBoostsActions from './preload-actions/xpboosts'
import * as worldInfoActions from './preload-actions/world-info'

export const availableElectronAPIs = {
  ...accountHealthActions,
  ...accountsActions,
  ...alertsActions,
  ...authenticationActions,
  ...autoLlamasActions,
  ...automationsActions,
  ...customizableMenuActions,
  ...autoPinUrnsActions,
  ...devicesAuthActions,
  ...enduranceActions,
  ...eventActions,
  ...expeditionsActions,
  ...friendsManagerActions,
  ...gameInstallActions,
  ...generalActions,
  ...shellActions,
  ...inventoryActions,
  ...itemActionsActions,
  ...itemDatabaseActions,
  ...launcherActions,
  ...loadoutsActions,
  ...partyActions,
  ...pluginsActions,
  ...questsActions,
  ...redeemCodesActions,
  ...matchmakingActions,
  ...mcpActions,
  ...requestActions,
  ...scheduleActions,
  ...serverStatusActions,
  ...settingsActions,
  ...shopActions,
  ...squadsActions,
  ...taxiservicesActions,
  ...timelineActions,
  ...vbucksInformationActions,
  ...xpBoostsActions,
  ...worldInfoActions,
} as const

contextBridge.exposeInMainWorld('electronAPI', availableElectronAPIs)
