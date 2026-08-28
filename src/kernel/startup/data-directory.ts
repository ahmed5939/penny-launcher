import type { AccountList } from '../../types/accounts'
import type { AutoLlamasRecord } from '../../types/auto-llamas'
import type { AutomationAccountFileDataList } from '../../types/automation'
import type { FriendRecord } from '../../types/friends'
import type {
  AppLanguageSettings,
  CustomizableMenuSettings,
  DevSettings,
  Settings,
} from '../../types/settings'
import type { TaxiServiceAccountFileDataList } from '../../types/taxi-service'
import type { AutoPinUrnDataList } from '../../types/urns'

import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { app, safeStorage } from 'electron'

import { defaultMissionInterval } from '../../config/constants/automation'
import { defaultClaimingRewardsDelay } from '../../config/constants/mcp'

import { accountListSchema } from '../../lib/validations/schemas/accounts'
import { autoLlamasDataRecordSchema } from '../../lib/validations/schemas/auto-llamas'
import { autoPinUrnsDataSchema } from '../../lib/validations/schemas/auto-pin-urns-data'
import { automationFileSchema } from '../../lib/validations/schemas/automation'
import { friendsSchema } from '../../lib/validations/schemas/friends'
import {
  appLanguageSchema,
  customizableMenuSettingsSchema,
  devSettingsSchema,
  settingsSchema,
} from '../../lib/validations/schemas/settings'
import { taxiServiceFileSchema } from '../../lib/validations/schemas/taxi-service'

import {
  accountNeedsSecretMigration,
  decryptAccountSecrets,
  encryptAccountSecrets,
  type SecretVault,
} from '../account-secrets'
import { resolveLauncherDataDirectory } from '../launcher-paths'
import { RuntimeLog } from '../runtime-log'

function readElectronAppDataPath() {
  try {
    return app.getPath('appData')
  } catch {
    return undefined
  }
}

export class DataDirectory {
  private static devPrefix = 'dev-'
  private static writeQueues = new Map<string, Promise<void>>()
  private static secretVault: SecretVault = {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encryptString: (plainText) => safeStorage.encryptString(plainText),
    decryptString: (cipherText) => safeStorage.decryptString(cipherText),
  }

  /**
   * Folders
   */

  private static dataDirectoryPath = resolveLauncherDataDirectory(
    readElectronAppDataPath()
  )

  private static worldInfoDirectoryPath = path.join(
    DataDirectory.dataDirectoryPath,
    'world-info'
  )

  /**
   * Files
   */

  private static accountsFilePath = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? path.join(
        DataDirectory.dataDirectoryPath,
        `${DataDirectory.devPrefix}accounts.json`
      )
    : path.join(DataDirectory.dataDirectoryPath, 'accounts.json')
  private static accountsDefaultData: AccountList = []

  private static appLanguageFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'i18n.json'
  )

  private static settingsFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'settings.json'
  )
  private static settingsDefaultData: Settings = {
    autoDailyQuests: true,
    claimingRewards: `${defaultClaimingRewardsDelay}`,
    customProcess: 'FortniteClient-Win64-Shipping.exe',
    missionInterval: `${defaultMissionInterval}`,
    path: 'C:\\Program Files\\Epic Games\\Fortnite\\FortniteGame\\Binaries\\Win64',
    systemTray: false,
    discordRichPresence: true,
    userAgent: 'Fortnite/++Fortnite+Release-34.40-CL-41753727-Windows',
  }

  private static devSettingsFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'dev-settings.json'
  )
  private static devSettingsDefaultData: DevSettings = {}

  private static customizableMenuSettingsFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'customizable-menu.json'
  )
  private static customizableMenuSettingsDefaultData: CustomizableMenuSettings =
    {}

  private static friendsFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'friends.json'
  )
  private static friendsDefaultData: FriendRecord = {}

  static automationFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'automation.json'
  )
  private static automationDefaultData: AutomationAccountFileDataList = {}

  static taxiServiceFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'taxi-service.json'
  )
  private static taxiServiceDefaultData: TaxiServiceAccountFileDataList = {}

  static urnsFilePath = path.join(DataDirectory.dataDirectoryPath, 'urns.json')
  private static urnsDefaultData: AutoPinUrnDataList = {}

  static autoLlamasFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'auto-llamas.json'
  )
  private static autoLlamasDefaultData: AutoLlamasRecord = {}

  static miniBossesFilePath = path.join(
    DataDirectory.dataDirectoryPath,
    'mini-bosses.json'
  )
  private static miniBossesDefaultData: AutoPinUrnDataList = {}

  /**
   * Get default values
   */

  static getSettingsDefaultData() {
    return DataDirectory.settingsDefaultData
  }

  static getDevSettingsDefaultData() {
    return DataDirectory.devSettingsDefaultData
  }

  static getCustomizableMenuSettingsDefaultData() {
    return DataDirectory.customizableMenuSettingsDefaultData
  }

  /**
   * Get Path
   */

  static getDataDirectoryPath() {
    return DataDirectory.dataDirectoryPath
  }

  static getAppLanguageDirectoryPath() {
    return DataDirectory.appLanguageFilePath
  }

  static getWorldInfoDirectoryPath() {
    return DataDirectory.worldInfoDirectoryPath
  }

  /**
   * Create data directory and accounts.json
   */
  static async createDataResources() {
    // The base directory must exist before any of the files/subdirectories
    // can be created.
    await DataDirectory.checkOrCreateDataDirectory()

    // The remaining resources are independent of each other, so create them
    // in parallel instead of awaiting each one sequentially. This noticeably
    // speeds up cold startup (one I/O round-trip instead of ~13).
    await Promise.all([
      DataDirectory.checkOrCreateWorldInfoDirectory(),
      DataDirectory.getOrCreateAccountsJsonFile(),
      DataDirectory.getOrCreateSettingsJsonFile(),
      DataDirectory.getOrCreateCustomizableMenuSettingsJsonFile(),
      DataDirectory.getOrCreateFriendsJsonFile(),
      DataDirectory.getOrCreateAutomationJsonFile(),
      DataDirectory.getOrCreateTaxiServiceJsonFile(),
      DataDirectory.getOrCreateUrnsJsonFile(),
      DataDirectory.getOrCreateAutoLlamasJsonFile(),
      DataDirectory.getOrCreateMiniBossesJsonFile(),
    ])
  }

  /**
   * Get data from accounts.json
   */
  static async getAccountsFile(): Promise<{ accounts: AccountList }> {
    const result = await DataDirectory.getOrCreateAccountsJsonFile()

    try {
      const rawAccounts: unknown = JSON.parse(result)
      const list = accountListSchema.safeParse(rawAccounts)
      const storedAccounts = list.success ? list.data : []
      let hadDecryptFailure = false
      const accounts = storedAccounts.flatMap((account) => {
        try {
          return [decryptAccountSecrets(account, DataDirectory.secretVault)]
        } catch (error) {
          hadDecryptFailure = true
          RuntimeLog.error(`accounts:decrypt:${account.accountId}`, error)
          return []
        }
      })

      if (
        Array.isArray(rawAccounts) &&
        rawAccounts.length !== storedAccounts.length
      ) {
        RuntimeLog.error(
          'accounts:validation',
          new Error(
            `${rawAccounts.length - storedAccounts.length} invalid account record(s) were ignored.`
          )
        )
      }

      if (
        !hadDecryptFailure &&
        DataDirectory.secretVault.isEncryptionAvailable() &&
        storedAccounts.some(accountNeedsSecretMigration)
      ) {
        // Re-write so Aerial imports and older plaintext files pick up enc:v1:.
        await DataDirectory.updateAccountsFile(accounts)
      }

      return { accounts }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { accounts: DataDirectory.accountsDefaultData }
  }

  /**
   * Get data from i18n.json
   */
  static async getAppLanguageFile(): Promise<AppLanguageSettings | null> {
    const checkFile = () =>
      readFile(DataDirectory.appLanguageFilePath, {
        encoding: 'utf8',
      })
    let data: AppLanguageSettings | null = null

    try {
      const result = await checkFile()
      const settings = appLanguageSchema.safeParse(JSON.parse(result))

      if (settings.success) {
        data = settings.data
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return data
  }

  /**
   * Get data from settings.json
   */
  static async getSettingsFile(): Promise<{ settings: Settings }> {
    const result = await DataDirectory.getOrCreateSettingsJsonFile()

    try {
      const list = settingsSchema.safeParse(JSON.parse(result))
      const settings = list.success
        ? list.data
        : DataDirectory.settingsDefaultData

      return { settings }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { settings: DataDirectory.settingsDefaultData }
  }

  /**
   * Get data from dev-settings.json
   */
  static async getDevSettingsFile(): Promise<{
    devSettings: DevSettings
  }> {
    try {
      const result = await readFile(DataDirectory.devSettingsFilePath, {
        encoding: 'utf8',
      })
      const list = devSettingsSchema.safeParse(JSON.parse(result))
      const devSettings = list.success
        ? list.data
        : DataDirectory.devSettingsDefaultData

      return { devSettings }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { devSettings: DataDirectory.devSettingsDefaultData }
  }

  /**
   * Get data from customizable-menu.json
   */
  static async getCustomizableMenuSettingsFile(): Promise<{
    customizableMenu: CustomizableMenuSettings
  }> {
    const result =
      await DataDirectory.getOrCreateCustomizableMenuSettingsJsonFile()

    try {
      const list = customizableMenuSettingsSchema.safeParse(JSON.parse(result))
      const customizableMenu = list.success
        ? list.data
        : DataDirectory.customizableMenuSettingsDefaultData

      return { customizableMenu }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return {
      customizableMenu: DataDirectory.customizableMenuSettingsDefaultData,
    }
  }

  /**
   * Get data from friends.json
   */
  static async getFriendsFile(): Promise<{ friends: FriendRecord }> {
    const result = await DataDirectory.getOrCreateFriendsJsonFile()

    try {
      const list = friendsSchema.safeParse(JSON.parse(result))
      const friends = list.success
        ? list.data
        : DataDirectory.friendsDefaultData

      return { friends }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { friends: DataDirectory.friendsDefaultData }
  }

  /**
   * Get data from automation.json
   */
  static async getAutomationFile(): Promise<{
    automation: AutomationAccountFileDataList
  }> {
    const result = await DataDirectory.getOrCreateAutomationJsonFile()

    try {
      const list = automationFileSchema.safeParse(JSON.parse(result))
      const automation = list.success
        ? list.data
        : DataDirectory.automationDefaultData

      return { automation }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { automation: DataDirectory.automationDefaultData }
  }

  /**
   * Get data from taxi-service.json
   */
  static async getTaxiServiceFile(): Promise<{
    taxiService: TaxiServiceAccountFileDataList
  }> {
    const result = await DataDirectory.getOrCreateTaxiServiceJsonFile()

    try {
      const list = taxiServiceFileSchema.safeParse(JSON.parse(result))
      const taxiService = list.success
        ? list.data
        : DataDirectory.taxiServiceDefaultData

      return { taxiService }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { taxiService: DataDirectory.taxiServiceDefaultData }
  }

  /**
   * Get data from urns.json
   */
  static async getUrnsFile(): Promise<{
    urns: AutoPinUrnDataList
  }> {
    const result = await DataDirectory.getOrCreateUrnsJsonFile()

    try {
      const list = autoPinUrnsDataSchema.safeParse(JSON.parse(result))
      const urns = list.success ? list.data : DataDirectory.urnsDefaultData

      return { urns }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { urns: DataDirectory.urnsDefaultData }
  }

  /**
   * Get data from auto-llamas.json
   */
  static async getAutoLlamasFile(): Promise<{
    autoLlamas: AutoLlamasRecord
  }> {
    const result = await DataDirectory.getOrCreateAutoLlamasJsonFile()

    try {
      const list = autoLlamasDataRecordSchema.safeParse(JSON.parse(result))
      const autoLlamas = list.success
        ? list.data
        : DataDirectory.autoLlamasDefaultData

      return { autoLlamas }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { autoLlamas: DataDirectory.autoLlamasDefaultData }
  }

  /**
   * Get data from mini-bosses.json
   */
  static async getMiniBossesFile(): Promise<{
    miniBosses: AutoPinUrnDataList
  }> {
    const result = await DataDirectory.getOrCreateMiniBossesJsonFile()

    try {
      const list = autoPinUrnsDataSchema.safeParse(JSON.parse(result))
      const miniBosses = list.success
        ? list.data
        : DataDirectory.miniBossesDefaultData

      return { miniBosses }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:startup/data-directory.ts', error)
    }

    return { miniBosses: DataDirectory.miniBossesDefaultData }
  }

  /**
   * Update accounts.json
   */
  static async updateAccountsFile(data: AccountList) {
    await DataDirectory.updateJsonFile(
      DataDirectory.accountsFilePath,
      data.map((account) =>
        encryptAccountSecrets(account, DataDirectory.secretVault)
      ),
      true
    )
  }

  /**
   * Update settings.json
   */
  static async updateSettingsFile(data: Settings) {
    await DataDirectory.updateJsonFile(DataDirectory.settingsFilePath, data)
  }

  /**
   * Update settings.json
   */
  static async updateCustomizableMenuSettingsFile(
    data: CustomizableMenuSettings
  ) {
    await DataDirectory.updateJsonFile(
      DataDirectory.customizableMenuSettingsFilePath,
      data
    )
  }

  /**
   * Update friends.json
   */
  static async updateFriendsFile(data: FriendRecord) {
    await DataDirectory.updateJsonFile(DataDirectory.friendsFilePath, data)
  }

  /**
   * Update automation.json
   */
  static async updateAutomationFile(data: AutomationAccountFileDataList) {
    await DataDirectory.updateJsonFile(DataDirectory.automationFilePath, data)
  }

  /**
   * Update taxi-service.json
   */
  static async updateTaxiServiceFile(data: TaxiServiceAccountFileDataList) {
    await DataDirectory.updateJsonFile(DataDirectory.taxiServiceFilePath, data)
  }

  /**
   * Update urns.json
   */
  static async updateUrnsFile(data: AutoPinUrnDataList) {
    await DataDirectory.updateJsonFile(DataDirectory.urnsFilePath, data)
  }

  /**
   * Update auto-llamas.json
   */
  static async updateAutoLlamasFile(data: AutoLlamasRecord) {
    await DataDirectory.updateJsonFile(DataDirectory.autoLlamasFilePath, data)
  }

  /**
   * Update mini-bosses.json
   */
  static async updateMiniBossesFile(data: AutoPinUrnDataList) {
    await DataDirectory.updateJsonFile(DataDirectory.miniBossesFilePath, data)
  }

  /**
   * Creating World Info directory
   */
  static async checkOrCreateWorldInfoDirectory() {
    const checkDirectory = () => readdir(DataDirectory.worldInfoDirectoryPath)

    try {
      await checkDirectory()

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      await mkdir(DataDirectory.worldInfoDirectoryPath)
    }

    return DataDirectory.worldInfoDirectoryPath
  }

  /**
   * Creating data directory
   */
  private static async checkOrCreateDataDirectory() {
    const checkDirectory = () => readdir(DataDirectory.dataDirectoryPath)

    try {
      await checkDirectory()

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      await mkdir(DataDirectory.dataDirectoryPath)
    }

    return DataDirectory.dataDirectoryPath
  }

  /**
   * Creating accounts.json
   */
  private static async getOrCreateAccountsJsonFile() {
    const initialData = DataDirectory.accountsDefaultData

    return await DataDirectory.getOrCreateJsonFile(
      DataDirectory.accountsFilePath,
      {
        defaults: {
          rawString: JSON.stringify(initialData),
          value: initialData,
        },
      }
    )
  }

  /**
   * Creating settings.json
   */
  private static async getOrCreateSettingsJsonFile() {
    const initialData = DataDirectory.settingsDefaultData

    return await DataDirectory.getOrCreateJsonFile(
      DataDirectory.settingsFilePath,
      {
        defaults: {
          rawString: JSON.stringify(initialData),
          value: initialData,
        },
      }
    )
  }

  /**
   * Creating customizable-menu.json
   */
  private static async getOrCreateCustomizableMenuSettingsJsonFile() {
    const initialData = DataDirectory.customizableMenuSettingsDefaultData

    return await DataDirectory.getOrCreateJsonFile(
      DataDirectory.customizableMenuSettingsFilePath,
      {
        defaults: {
          rawString: JSON.stringify(initialData),
          value: initialData,
        },
      }
    )
  }

  /**
   * Creating friends.json
   */
  private static async getOrCreateFriendsJsonFile() {
    const initialData = DataDirectory.friendsDefaultData

    return await DataDirectory.getOrCreateJsonFile(
      DataDirectory.friendsFilePath,
      {
        defaults: {
          rawString: JSON.stringify(initialData),
          value: initialData,
        },
      }
    )
  }

  /**
   * Creating automation.json
   */
  private static async getOrCreateAutomationJsonFile() {
    const initialData = DataDirectory.automationDefaultData

    return await DataDirectory.getOrCreateJsonFile(
      DataDirectory.automationFilePath,
      {
        defaults: {
          rawString: JSON.stringify(initialData),
          value: initialData,
        },
      }
    )
  }

  /**
   * Creating taxi-service.json
   */
  private static async getOrCreateTaxiServiceJsonFile() {
    const initialData = DataDirectory.taxiServiceDefaultData

    return await DataDirectory.getOrCreateJsonFile(
      DataDirectory.taxiServiceFilePath,
      {
        defaults: {
          rawString: JSON.stringify(initialData),
          value: initialData,
        },
      }
    )
  }

  /**
   * Creating urns.json
   */
  private static async getOrCreateUrnsJsonFile() {
    const initialData = DataDirectory.urnsDefaultData

    return await DataDirectory.getOrCreateJsonFile(DataDirectory.urnsFilePath, {
      defaults: {
        rawString: JSON.stringify(initialData),
        value: initialData,
      },
    })
  }

  /**
   * Creating auto-llamas.json
   */
  private static async getOrCreateAutoLlamasJsonFile() {
    const initialData = DataDirectory.autoLlamasDefaultData

    return await DataDirectory.getOrCreateJsonFile(
      DataDirectory.autoLlamasFilePath,
      {
        defaults: {
          rawString: JSON.stringify(initialData),
          value: initialData,
        },
      }
    )
  }

  /**
   * Creating mini-bosses.json
   */
  private static async getOrCreateMiniBossesJsonFile() {
    const initialData = DataDirectory.miniBossesDefaultData

    return await DataDirectory.getOrCreateJsonFile(
      DataDirectory.miniBossesFilePath,
      {
        defaults: {
          rawString: JSON.stringify(initialData),
          value: initialData,
        },
      }
    )
  }

  /**
   * Creating json file
   */
  private static async getOrCreateJsonFile(
    currentPath: string,
    config: {
      defaults: {
        rawString: string
        value: unknown
      }
    }
  ) {
    const checkFile = () =>
      readFile(currentPath, {
        encoding: 'utf8',
      })
    let result: string | undefined

    try {
      result = await checkFile()

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      await writeFile(
        currentPath,
        JSON.stringify(config.defaults.value, null, 2),
        {
          encoding: 'utf8',
        }
      )
      result = await checkFile()
    }

    return result ?? config.defaults.rawString
  }

  /**
   * Update json file
   */
  private static async updateJsonFile<Data>(
    currentPath: string,
    data: Data,
    sensitive = false
  ) {
    if (!data) {
      return
    }

    const previous = DataDirectory.writeQueues.get(currentPath)
    const queued = (previous ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        const temporaryPath = `${currentPath}.tmp`
        const backupPath = `${currentPath}.bak`

        try {
          await writeFile(temporaryPath, JSON.stringify(data ?? [], null, 2), {
            encoding: 'utf8',
          })

          if (sensitive) {
            // Never preserve a legacy plaintext credential file as a backup.
            await rm(backupPath, { force: true }).catch(() => {})
          } else {
            await copyFile(currentPath, backupPath).catch(() => {})
          }
          await rename(temporaryPath, currentPath)

          if (sensitive) {
            await copyFile(currentPath, backupPath).catch(() => {})
          }
        } catch (error) {
          await rm(temporaryPath, { force: true }).catch(() => {})
          throw new Error(`Could not save ${path.basename(currentPath)}.`, {
            cause: error,
          })
        }
      })

    DataDirectory.writeQueues.set(currentPath, queued)

    try {
      await queued
    } finally {
      if (DataDirectory.writeQueues.get(currentPath) === queued) {
        DataDirectory.writeQueues.delete(currentPath)
      }
    }
  }
}
