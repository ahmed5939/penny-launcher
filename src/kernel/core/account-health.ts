import type { AccountData } from '../../types/accounts'
import type { ProfileEntry, ProfilePayload } from '../../features/commander-profile/model'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from '../startup/windows/main'
import { Authentication } from './authentication'

import { parseCommanderProfile } from '../../features/commander-profile/model'
import { getQueryProfile } from '../../services/endpoints/mcp'

export type {
  ProfileEntry,
  ProfileFort,
  ProfileHero,
  ProfilePayload,
  ProfileSetBonus,
  ProfileSquadSummary,
  ProfileStack,
} from '../../features/commander-profile/model'

/**
 * The account's commander profile, from its own campaign profile — the same
 * authenticated QueryProfile every other STW page reads. Read-only.
 */
export class AccountHealth {
  static async request(accounts: Array<AccountData>) {
    accounts.forEach((account) => {
      AccountHealth.getInfo(account)
        .catch(
          (): ProfileEntry => ({
            ...emptyEntry(account),
            errorMessage: 'Unknown Error',
          })
        )
        .then((entry) => {
          MainWindow.instance.webContents.send(
            ElectronAPIEventKeys.AccountHealthResponse,
            { [account.accountId]: entry } as ProfilePayload
          )
        })
    })
  }

  private static async getInfo(account: AccountData): Promise<ProfileEntry> {
    const accessToken = await Authentication.verifyAccessToken(account)

    if (!accessToken) {
      return { ...emptyEntry(account), errorMessage: 'Unknown Error' }
    }

    const response = await getQueryProfile({ accessToken, accountId: account.accountId })

    return parseCommanderProfile(response.data, account.accountId, account.displayName)
  }
}

function emptyEntry(account: AccountData): ProfileEntry {
  return {
    accountId: account.accountId,
    collectionBookLevel: 0,
    commander: null,
    commanderLevel: 0,
    counts: { defenders: 0, heroes: 0, schematics: 0, survivors: 0 },
    daysLoggedIn: 0,
    displayName: account.displayName,
    fort: null,
    llamas: [],
    matchesPlayed: 0,
    pending: { difficultyIncreaseRewards: 0, missionAlertRewards: 0 },
    postMaxLevels: 0,
    power: null,
    resources: [],
    setBonuses: [],
    squads: [],
    support: [],
    ventures: null,
  }
}
