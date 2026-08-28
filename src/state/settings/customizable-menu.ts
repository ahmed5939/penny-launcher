import type { CustomizableMenuSettings } from '../../types/settings'

import { immer } from 'zustand/middleware/immer'
import { create } from 'zustand'

export type CustomizableMenuSettingsState = {
  data: CustomizableMenuSettings

  syncMenuOptions: (data: CustomizableMenuSettings) => void
  updateMenuOption: (
    key: keyof CustomizableMenuSettings,
  ) => (visibility: boolean) => void
}

export const customizableMenuSettingsRelations: Record<
  keyof Pick<
    CustomizableMenuSettings,
    | 'currentAlerts'
    | 'stwOperations'
    | 'accountManagement'
    | 'advancedMode'
    | 'myAccounts'
  >,
  Array<
    keyof Omit<
      CustomizableMenuSettings,
      | 'currentAlerts'
      | 'stwOperations'
      | 'accountManagement'
      | 'advancedMode'
      | 'myAccounts'
    >
  >
> = {
  currentAlerts: [],
  stwOperations: [
    'autoKick',
    'taxiService',
    'party',
    'expeditions',
    'squadPresets',
    'inventory',
    'compendium',
    'timeline',
    'quests',
    'loadouts',
    'shop',
    'xpBoosts',
    'autoPinUrns',
    'autoLlamas',
    'outpost',
    'endurance',
  ],
  accountManagement: [
    'vbucksInformation',
    'giftsInformation',
    'profile',
    'redeemCodes',
    'devicesAuth',
    'epicGamesSettings',
    'eula',
  ],
  advancedMode: ['matchmakingTrack', 'serverStatus', 'worldInfo'],
  myAccounts: [
    'authorizationCode',
    'exchangeCode',
    'deviceAuth',
    'removeAccount',
  ],
}

export function isMenuOptionVisible(
  data: CustomizableMenuSettings,
  key: keyof CustomizableMenuSettings,
  validateItems = false,
): boolean {
  const keyValidation = data[key] ?? true

  if (validateItems) {
    const childItems =
      customizableMenuSettingsRelations[
        key as keyof typeof customizableMenuSettingsRelations
      ]

    if (childItems !== undefined) {
      return childItems.some((item) => data[item] ?? true) && keyValidation
    }
  }

  return keyValidation
}

export const useCustomizableMenuSettingsStore =
  create<CustomizableMenuSettingsState>()(
    immer((set) => ({
      data: {},

      syncMenuOptions: (data) => {
        set({ data })
      },
      updateMenuOption: (key) => (visibility) => {
        set((state) => {
          state.data[key] = visibility

          window.electronAPI?.customizableMenuDataUpdate(key, visibility)
        })
      },
    })),
  )
