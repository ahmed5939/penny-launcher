import type {
  AutoPinQuestDataList,
  AutoPinUrnDataList,
  AutoPinUrnDataValue,
} from '../../types/urns'

import { Collection } from '@discordjs/collection'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { MainWindow } from './windows/main'
import { AccountsManager } from './accounts'
import { DataDirectory } from './data-directory'

export class AutoPinUrns {
  private static _quests: Collection<string, Array<string>> = new Collection()
  private static _accounts: Collection<string, AutoPinUrnDataValue> =
    new Collection()
  private static _accountsMiniBosses: Collection<
    string,
    AutoPinUrnDataValue
  > = new Collection()

  static async load() {
    AutoPinUrns._quests.clear()
    AutoPinUrns._accounts.clear()
    AutoPinUrns._accountsMiniBosses.clear()

    const { quests } = await DataDirectory.getAutoPinQuestsFile()
    const { urns } = await DataDirectory.getUrnsFile()
    const { miniBosses } = await DataDirectory.getMiniBossesFile()
    const accounts = AccountsManager.getAccounts()

    Object.entries(quests).forEach(([accountId, templateIds]) => {
      if (accounts.has(accountId)) {
        AutoPinUrns._quests.set(accountId, templateIds)
      }
    })

    Object.entries(urns).forEach(([accountId, value]) => {
      if (accounts.has(accountId)) {
        AutoPinUrns._accounts.set(accountId, value)
      }
    })

    Object.entries(miniBosses).forEach(([accountId, value]) => {
      if (accounts.has(accountId)) {
        AutoPinUrns._accountsMiniBosses.set(accountId, value)
      }
    })

    // One-time compatibility migration from the original two switches.
    for (const accountId of accounts.keys()) {
      if (AutoPinUrns._quests.has(accountId)) continue

      const templateIds = [
        urns[accountId] ? 'Quest:starlightquest_destroy_urns' : null,
        miniBosses[accountId]
          ? 'Quest:starlightquest_kill_minibosses'
          : null,
      ].filter((value): value is string => value !== null)

      if (urns[accountId] !== undefined || miniBosses[accountId] !== undefined) {
        AutoPinUrns._quests.set(accountId, templateIds)
      }
    }

    await AutoPinUrns.persist()

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.UrnsServiceResponseData,
      {
        quests: Object.fromEntries(AutoPinUrns._quests),
      }
    )
  }

  static async addAccount(accountId: string) {
    AutoPinUrns._quests.set(accountId, [])
    await AutoPinUrns.persist()
  }

  static async removeAccount(accountId: string) {
    AutoPinUrns._quests.delete(accountId)
    await AutoPinUrns.persist()
    const urns = [...AutoPinUrns._accounts.entries()]
      .filter(([currentAccountId]) => currentAccountId !== accountId)
      .reduce((accumulator, [accountId, value]) => {
        accumulator[accountId] = value

        return accumulator
      }, {} as AutoPinUrnDataList)
    const miniBosses = [...AutoPinUrns._accountsMiniBosses.entries()]
      .filter(([currentAccountId]) => currentAccountId !== accountId)
      .reduce((accumulator, [accountId, value]) => {
        accumulator[accountId] = value

        return accumulator
      }, {} as AutoPinUrnDataList)

    AutoPinUrns._accounts.delete(accountId)
    AutoPinUrns._accountsMiniBosses.delete(accountId)

    await DataDirectory.updateUrnsFile(urns)
    await DataDirectory.updateMiniBossesFile(miniBosses)
  }

  static async updateAccount(
    accountId: string,
    templateId: string,
    value: AutoPinUrnDataValue
  ) {
    const current = AutoPinUrns._quests.get(accountId) ?? []
    const next = value
      ? [...new Set([...current, templateId])]
      : current.filter((id) => id !== templateId)
    AutoPinUrns._quests.set(accountId, next)
    await AutoPinUrns.persist()
  }

  static findById(accountId: string) {
    return AutoPinUrns._quests.get(accountId) ?? []
  }

  private static async persist() {
    await DataDirectory.updateAutoPinQuestsFile(
      Object.fromEntries(AutoPinUrns._quests) as AutoPinQuestDataList
    )
  }
}
