import type {
  AccountBasicInfo,
  AccountData,
  AccountDataList,
  AccountDataRecord,
  AccountList,
} from '../../types/accounts'
import type { AerialImportCallbackResponseParam } from '../../types/preload'

import { Collection } from '@discordjs/collection'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { accountListSchema } from '../../lib/validations/schemas/accounts'

import { MainWindow } from './windows/main'
import { Automation } from './automation'
import { DataDirectory } from './data-directory'
import { PluginBridge } from './plugin-api'
import { RuntimeLog } from '../runtime-log'

export class AccountsManager {
  private static _accounts: Collection<string, AccountData> =
    new Collection()

  static toRenderer(account: AccountData): AccountData {
    return {
      ...account,
      accessToken: undefined,
      deviceId: '',
      secret: '',
    }
  }

  static async load() {
    const result = await DataDirectory.getAccountsFile()
    const accounts: AccountDataList = result.accounts.map((account) => {
      const data: AccountData = {
        ...account,
        accessToken: undefined,
        customDisplayName: account.customDisplayName ?? '',
        provider: undefined,
      }

      return data
    })

    const accountsRecord = accounts.reduce((accumulator, current) => {
      accumulator[current.accountId] = AccountsManager.toRenderer(current)

      AccountsManager._accounts.set(current.accountId, current)

      return accumulator
    }, {} as AccountDataRecord)

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.OnAccountsLoaded,
      accountsRecord
    )
    PluginBridge.emit('accounts-changed')
  }

  static async add(data: AccountBasicInfo) {
    const result = await DataDirectory.getAccountsFile()
    const accounts: AccountList = result.accounts.map((account) => {
      if (account.accountId === data.accountId) {
        return {
          ...account,
          ...data,
        }
      }

      return account
    })

    const current = accounts.find(
      (item) => item.accountId === data.accountId
    )

    if (!current) {
      accounts.push(data)
    }

    AccountsManager._accounts.set(data.accountId, {
      ...data,
      accessToken: undefined,
      customDisplayName: data.customDisplayName ?? '',
      provider: undefined,
    })

    await DataDirectory.updateAccountsFile(accounts)
    PluginBridge.emit('accounts-changed')
  }

  /**
   * One-click migration from Aerial Launcher.
   *
   * Penny began as an Aerial fork, so Aerial's accounts.json uses the same
   * shape ours does — accounts can be copied straight across without
   * touching Epic. Secrets are re-encrypted on write; Aerial stores them in
   * plain text.
   */
  static async importFromAerial() {
    const respond = (response: AerialImportCallbackResponseParam) => {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.ResponseImportAccountsFromAerial,
        response
      )
    }

    const aerialAccountsFilePath = path.join(
      app.getPath('appData'),
      'aerial-launcher-data',
      'accounts.json'
    )

    let aerialAccounts: AccountList

    try {
      const raw = await readFile(aerialAccountsFilePath, 'utf8')

      aerialAccounts = accountListSchema.parse(JSON.parse(raw))
    } catch (error) {
      const missingFile =
        (error as NodeJS.ErrnoException).code === 'ENOENT'

      if (!missingFile) {
        RuntimeLog.error('accounts:import-from-aerial', error)
      }

      respond({
        status: missingFile ? 'no-file' : 'error',
        imported: 0,
        skipped: 0,
        accounts: null,
      })

      return
    }

    const fresh = aerialAccounts.filter(
      (account) => !AccountsManager._accounts.has(account.accountId)
    )

    if (fresh.length === 0) {
      respond({
        status: 'nothing-new',
        imported: 0,
        skipped: aerialAccounts.length,
        accounts: null,
      })

      return
    }

    const { accounts } = await DataDirectory.getAccountsFile()

    await DataDirectory.updateAccountsFile([...accounts, ...fresh])

    const imported = fresh.reduce((accumulator, account) => {
      const data: AccountData = {
        ...account,
        accessToken: undefined,
        customDisplayName: account.customDisplayName ?? '',
        provider: undefined,
      }

      AccountsManager._accounts.set(account.accountId, data)
      accumulator[account.accountId] = AccountsManager.toRenderer(data)

      return accumulator
    }, {} as AccountDataRecord)

    PluginBridge.emit('accounts-changed')
    respond({
      status: 'success',
      imported: fresh.length,
      skipped: aerialAccounts.length - fresh.length,
      accounts: imported,
    })
  }

  static async remove(accountId: string) {
    const result = await DataDirectory.getAccountsFile()
    const accounts = result.accounts.filter(
      (account) => account.accountId !== accountId
    )

    AccountsManager._accounts.delete(accountId)
    Automation.removeAccount(accountId)

    await DataDirectory.updateAccountsFile(accounts)
    PluginBridge.emit('accounts-changed')
  }

  static getAccounts(): Collection<string, AccountData> {
    return AccountsManager._accounts.clone()
  }

  static getAccountById(accountId: string): AccountData | undefined {
    return AccountsManager._accounts.get(accountId)
  }

  static syncAccount(accountId: string, data: Partial<AccountData>) {
    const current = AccountsManager._accounts.get(accountId)

    if (!current) {
      return
    }

    AccountsManager._accounts.set(accountId, {
      ...current,
      ...data,
    })
  }

  static async reorder(accounts: AccountDataRecord) {
    const removeExtraProperties = Object.values(accounts).flatMap(
      ({ accountId, displayName, customDisplayName }) => {
        const stored = AccountsManager._accounts.get(accountId)

        return stored
          ? [{
              accountId,
              deviceId: stored.deviceId,
              displayName,
              secret: stored.secret,
              customDisplayName,
            }]
          : []
      },
    )

    await DataDirectory.updateAccountsFile(removeExtraProperties)
  }
}
